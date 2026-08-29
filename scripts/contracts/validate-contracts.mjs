import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  collectReferences,
  dereference,
  isHttpMethod,
  isRecord,
  isWriteMethod,
  readJson,
  resolveJsonPointer,
} from './schema-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const openApiPath = path.join(repoRoot, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const eventCatalogPath = path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'catalog.json');
const schemaRegistryPath = path.join(repoRoot, 'packages', 'contracts', 'schemas', 'v1', 'registry.json');

const forbiddenFieldPatterns = [
  /^(access|refresh)?token$/i,
  /^authorization$/i,
  /^password$/i,
  /^(apiKey|secret|privateKey|clientSecret)$/i,
  /^(phone|mobile|email|realName|identityToken|thirdPartySubject)$/i,
  /^(rawAnswer|answerText|answerContent|userInput|prompt)$/i,
  /^(audio|video|rawRecording|recordingBytes|screenPixels|imageBytes)$/i,
  /^(paymentCallbackRaw|jws|signedPayload|webhookBody)$/i,
  /^(deviceFingerprint|ipAddress|cookie)$/i,
];

function fail(message) {
  throw new Error(`[contracts] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function walk(value, visitor, location = '$') {
  visitor(value, location);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) walk(child, visitor, `${location}.${key}`);
}

function assertRefsResolve(document, value, location) {
  for (const reference of collectReferences(value)) {
    try {
      resolveJsonPointer(document, reference);
    } catch (error) {
      fail(`${location} contains unresolved reference ${reference}: ${error.message}`);
    }
  }
}

function encodeJsonPointerToken(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

function validateEventPlatformMetadata(catalog) {
  const platform = catalog['x-v2-event-platform'];
  assert(isRecord(platform), 'x-v2-event-platform metadata is required');
  assert(platform.transport === 'kafka-compatible-only', 'v2 event transport must be Kafka-compatible-only');
  assert(platform.publication === 'transactional-outbox', 'v2 events must use transactional Outbox publication');
  assert(platform.contract === 'asyncapi', 'v2 event contract must be AsyncAPI');
  assert(platform.redis === 'not-an-event-source', 'Redis must not be a v2 event source of fact');
  assert(platform.coreApiV1Compatibility === 'RabbitMQ-only core-api v1 historical migration compatibility', 'RabbitMQ must be limited to core-api v1 historical migration compatibility');
}

function expectedAsyncApiChannelAddress(event) {
  const topic = event['x-kafka']?.topic;
  if (topic !== undefined) {
    assert(typeof topic === 'string' && topic.length > 0, `${event.eventName} x-kafka.topic must be a non-empty string when declared`);
    return topic;
  }
  return event.eventName;
}

/**
 * The catalog embeds a canonical AsyncAPI 3.0 document rather than being a
 * standalone AsyncAPI file. Its local references intentionally resolve from
 * the catalog root (for example #/asyncapi/channels and #/payloadSchemas).
 */
function validateAsyncApiProjection(catalog) {
  const asyncapi = catalog.asyncapi;
  assert(isRecord(asyncapi), 'embedded canonical AsyncAPI projection is required');
  assert(asyncapi.asyncapi === '3.0.0', 'embedded AsyncAPI projection must use the standard asyncapi: 3.0.0 root field');
  assert(!Object.hasOwn(asyncapi, 'version'), 'embedded AsyncAPI projection must not use the legacy version root field');
  assert(isRecord(asyncapi.info), 'AsyncAPI projection info is required');
  assert(asyncapi.info.title === '语学星 v2 平台集成事件', 'AsyncAPI projection must use the platform-level title');
  assert(asyncapi.info.version === catalog.catalogVersion, 'AsyncAPI info.version must match catalogVersion');
  assert(typeof asyncapi.info.description === 'string' && asyncapi.info.description.length > 0, 'AsyncAPI platform description is required');
  assert(isRecord(asyncapi.channels), 'AsyncAPI projection channels are required');
  assert(isRecord(asyncapi.operations), 'AsyncAPI projection operations are required');

  const eventsByName = new Map(catalog.events.map((event) => [event.eventName, event]));
  const channelEntries = Object.entries(asyncapi.channels);
  const operationEntries = Object.entries(asyncapi.operations);
  assert(channelEntries.length === catalog.events.length, 'AsyncAPI must project exactly one channel per active event');
  assert(operationEntries.length === catalog.events.length, 'AsyncAPI must project exactly one send operation per active event');

  const channelKeys = new Set();
  const channelByEventName = new Map();
  const channelDetailsByReference = new Map();
  for (const [channelKey, channel] of channelEntries) {
    assert(!channelKeys.has(channelKey), `duplicate AsyncAPI channel key ${channelKey}`);
    channelKeys.add(channelKey);
    assert(isRecord(channel), `AsyncAPI channel ${channelKey} must be an object`);
    assert(typeof channel.address === 'string' && channel.address.length > 0, `AsyncAPI channel ${channelKey} needs a concrete address`);
    const messageEntries = Object.entries(channel.messages ?? {});
    assert(messageEntries.length === 1, `AsyncAPI channel ${channelKey} must expose exactly one event message`);
    const [messageKey, message] = messageEntries[0];
    assert(isRecord(message) && !Object.hasOwn(message, '$ref'), `AsyncAPI channel ${channelKey} message ${messageKey} must be a Message Object, not a schema reference`);
    const eventName = message['x-event-name'] ?? message.name;
    assert(typeof eventName === 'string' && eventsByName.has(eventName), `AsyncAPI channel ${channelKey} message ${messageKey} has an orphan event identifier`);
    assert(message.name === eventName && message['x-event-name'] === eventName, `AsyncAPI channel ${channelKey} message ${messageKey} must explicitly identify ${eventName}`);
    assert(!channelByEventName.has(eventName), `AsyncAPI event ${eventName} has duplicate channels`);

    const event = eventsByName.get(eventName);
    assert(channel.address === expectedAsyncApiChannelAddress(event), `AsyncAPI channel ${channelKey} address must match ${eventName} Kafka topic/default address`);
    const kafkaBinding = channel.bindings?.kafka;
    if (kafkaBinding !== undefined) {
      assert(isRecord(kafkaBinding), `AsyncAPI channel ${channelKey} Kafka binding must be an object`);
      if (Object.hasOwn(kafkaBinding, 'topic')) assert(kafkaBinding.topic === channel.address, `AsyncAPI channel ${channelKey} Kafka binding topic must equal its address`);
    }
    assert(isRecord(message.payload) && typeof message.payload.$ref === 'string', `AsyncAPI channel ${channelKey} message ${messageKey} payload must be a local schema reference`);
    assert(message.payload.$ref === event.payloadSchema.$ref, `AsyncAPI channel ${channelKey} payload must match ${event.eventName}`);
    assertRefsResolve(catalog, message, `AsyncAPI channel ${channelKey} message ${messageKey}`);

    channelByEventName.set(eventName, channelKey);
    const channelReference = `#/asyncapi/channels/${encodeJsonPointerToken(channelKey)}`;
    channelDetailsByReference.set(channelReference, {
      channelKey,
      messageReference: `#/asyncapi/channels/${encodeJsonPointerToken(channelKey)}/messages/${encodeJsonPointerToken(messageKey)}`,
    });
  }
  assert(channelByEventName.size === catalog.events.length, 'every active event must have one AsyncAPI channel');

  const operationsByChannel = new Map();
  for (const [operationKey, operation] of operationEntries) {
    assert(isRecord(operation), `AsyncAPI operation ${operationKey} must be an object`);
    assert(operation.action === 'send', `AsyncAPI operation ${operationKey} must send an event message`);
    const channelReference = operation.channel?.$ref;
    assert(typeof channelReference === 'string', `AsyncAPI operation ${operationKey} must reference a channel`);
    const detail = channelDetailsByReference.get(channelReference);
    assert(detail, `AsyncAPI operation ${operationKey} references an orphan channel`);
    assert(Array.isArray(operation.messages) && operation.messages.length === 1, `AsyncAPI operation ${operationKey} must reference exactly one event message`);
    assert(operation.messages[0]?.$ref === detail.messageReference, `AsyncAPI operation ${operationKey} message must match channel ${detail.channelKey}`);
    assertRefsResolve(catalog, operation, `AsyncAPI operation ${operationKey}`);
    operationsByChannel.set(detail.channelKey, (operationsByChannel.get(detail.channelKey) ?? 0) + 1);
  }
  for (const channelKey of channelKeys) {
    assert(operationsByChannel.get(channelKey) === 1, `AsyncAPI channel ${channelKey} must have exactly one send operation`);
  }

  assertRefsResolve(catalog, asyncapi, 'embedded AsyncAPI projection');
  return { channelCount: channelEntries.length, operationCount: operationEntries.length };
}

function validateOpenApi(document) {
  assert(document.openapi === '3.0.3', 'OpenAPI source must be version 3.0.3');
  assert(isRecord(document.info) && typeof document.info.version === 'string', 'OpenAPI info.version is required');
  assert(isRecord(document.paths) && Object.keys(document.paths).length > 0, 'OpenAPI must define at least one path');
  assert(isRecord(document.components) && isRecord(document.components.schemas), 'OpenAPI components.schemas is required');

  const operationIds = new Map();
  let operationCount = 0;
  const securitySchemes = document.components.securitySchemes ?? {};
  assert(isRecord(securitySchemes.bearerAuth), 'OpenAPI bearerAuth security scheme is required');
  assert(isRecord(securitySchemes.B8ServiceIdentity), 'OpenAPI B8ServiceIdentity security scheme is required');
  assert(document['x-b8-authentication']?.mode === 'self-owned-jwt-authentication-center', 'self-owned JWT authentication metadata is required');
  assert(document['x-b8-authentication']?.accessToken?.audience === 'yuxuexing-api', 'JWT audience must be yuxuexing-api');
  assert(document['x-b8-authentication']?.accessToken?.algorithm === 'RS256', 'Phase 1 JWT algorithm must be RS256');
  const jwksKey = document.components.schemas?.B8JwksResponse?.properties?.keys?.items?.properties;
  assert(isRecord(jwksKey) && jwksKey.kty?.const === 'RSA' && jwksKey.alg?.const === 'RS256', 'JWKS key schema must be RSA/RS256 and match the Phase 1 JWT algorithm');
  for (const [route, pathItem] of Object.entries(document.paths)) {
    assert(!/\/auth\/oidc\b/i.test(route), `retired external authentication route must not exist: ${route}`);
    assert(route.startsWith('/api/v1/') || route.startsWith('/internal/v1/'), `route must use /api/v1 or /internal/v1 prefix: ${route}`);
    assert(isRecord(pathItem), `path item must be an object: ${route}`);
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue;
      operationCount += 1;
      assert(isRecord(operation), `${method.toUpperCase()} ${route} must be an object`);
      assert(typeof operation.operationId === 'string' && operation.operationId.length > 0, `${method.toUpperCase()} ${route} needs operationId`);
      assert(!operationIds.has(operation.operationId), `duplicate operationId: ${operation.operationId}`);
      operationIds.set(operation.operationId, `${method.toUpperCase()} ${route}`);
      assertRefsResolve(document, operation, `${method.toUpperCase()} ${route}`);
      if (route.startsWith('/internal/v1/')) {
        assert(Array.isArray(operation.security) && operation.security.length > 0, `${method.toUpperCase()} ${route} must require service identity`);
      }
      if ((operation.tags ?? []).some((tag) => String(tag).toLowerCase().startsWith('b8-'))) {
        assert(Array.isArray(operation.security), `${method.toUpperCase()} ${route} needs an explicit security declaration`);
        const requestSchema = operation.requestBody?.content?.['application/json']?.schema;
        const requestDocument = requestSchema ? dereference(document, requestSchema) : null;
        walk(requestDocument, (value, location) => {
          if (!isRecord(value)) return;
          for (const propertyName of Object.keys(value.properties ?? {})) {
            assert(!['tenantId', 'ownerId', 'role', 'roles', 'permission', 'permissions'].includes(propertyName), `${method.toUpperCase()} ${route} request ${location} cannot accept client authorization fact ${propertyName}`);
          }
        }, `${method.toUpperCase()} ${route}.request`);
        for (const parameter of operation.parameters ?? []) {
          const name = String(parameter.name ?? '').toLowerCase();
          assert(!['x-role', 'x-b5-role', 'x-tenant-id', 'x-owner-id'].includes(name), `${method.toUpperCase()} ${route} cannot accept client authorization header ${parameter.name}`);
        }
      }
      if (isWriteMethod(method)) {
        assert(isRecord(operation['x-idempotency']), `${method.toUpperCase()} ${route} needs x-idempotency declaration`);
        assert(typeof operation['x-idempotency'].strategy === 'string', `${operation.operationId} x-idempotency.strategy is required`);
        assert(typeof operation['x-idempotency'].replayBehavior === 'string', `${operation.operationId} x-idempotency.replayBehavior is required`);
      }
    }
  }
  assert(operationCount > 0, 'OpenAPI must define at least one operation');
  assertRefsResolve(document, document.components, 'OpenAPI components');

  const canonicalIds = document['x-canonical-id-fields'];
  assert(isRecord(canonicalIds) && Object.keys(canonicalIds).length >= 10, 'canonical ID registry is incomplete');
  for (const [field, reference] of Object.entries(canonicalIds)) {
    assert(typeof field === 'string' && /^[a-z][A-Za-z0-9]*$/.test(field), `invalid canonical ID field: ${field}`);
    assert(typeof reference === 'string', `canonical ID ${field} must reference a schema`);
    dereference(document, { $ref: reference });
  }

  walk(document.components.schemas, (value, location) => {
    if (!isRecord(value)) return;
    for (const field of value['x-sensitive-fields'] ?? []) {
      assert(typeof field === 'string', `${location}.x-sensitive-fields must contain strings`);
    }
    for (const [propertyName, propertySchema] of Object.entries(value.properties ?? {})) {
      if (forbiddenFieldPatterns.some((pattern) => pattern.test(propertyName))) {
        const declared = new Set(value['x-sensitive-fields'] ?? []);
        assert(declared.has(propertyName), `${location}.${propertyName} is sensitive and must be declared in x-sensitive-fields`);
        assert(propertySchema?.description && /禁止|原文|TLS|hash|敏感/i.test(propertySchema.description), `${location}.${propertyName} needs a storage/logging safety description`);
      }
    }
  });

  const b8ErrorCodes = document.components.schemas?.B8Error?.properties?.code?.enum ?? [];
  for (const requiredCode of ['unauthorized', 'forbidden', 'adult_gate_required', 'consent_required', 'session_revoked', 'policy_denied']) {
    assert(b8ErrorCodes.includes(requiredCode), `B8Error must distinguish ${requiredCode}`);
  }

  return { operationCount, schemaCount: Object.keys(document.components.schemas).length };
}

function validateEventCatalog(catalog) {
  assert(catalog.catalogVersion === '1.0.0', 'event catalogVersion must be 1.0.0');
  assert(catalog.schema === 'platform.event.catalog.v1', 'event catalog schema must be platform.event.catalog.v1');
  assert(isRecord(catalog.envelope) && catalog.envelope.schema === 'platform.event.v1', 'event envelope schema must be platform.event.v1');
  for (const requiredField of ['eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType', 'aggregateId', 'actorId', 'traceId', 'requestId', 'payload']) {
    assert(catalog.envelope.required.includes(requiredField), `event envelope missing ${requiredField}`);
  }
  assert(Array.isArray(catalog.events) && catalog.events.length >= 20, 'event catalog must contain at least 20 events');
  assert(isRecord(catalog.payloadSchemas) && Object.keys(catalog.payloadSchemas).length > 0, 'event payloadSchemas is required');
  assert(Array.isArray(catalog.forbiddenPayloadFieldPatterns), 'event forbiddenPayloadFieldPatterns is required');
  validateEventPlatformMetadata(catalog);

  const names = new Set();
  for (const event of catalog.events) {
    assert(isRecord(event), 'event entry must be an object');
    assert(typeof event.eventName === 'string' && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+\.v[0-9]+$/.test(event.eventName), `invalid eventName: ${event.eventName}`);
    assert(!names.has(event.eventName), `duplicate eventName: ${event.eventName}`);
    names.add(event.eventName);
    const versionMatch = event.eventName.match(/\.v([0-9]+)$/);
    assert(Number(event.version) === Number(versionMatch[1]), `${event.eventName} version must match eventName suffix`);
    assert(typeof event.domain === 'string' && /^[a-z][a-z0-9_]*$/.test(event.domain), `${event.eventName} domain is invalid`);
    assert(typeof event.aggregateType === 'string' && /^[a-z][a-z0-9_]{1,63}$/.test(event.aggregateType), `${event.eventName} aggregateType is invalid`);
    assert(isRecord(event.payloadSchema) && typeof event.payloadSchema.$ref === 'string', `${event.eventName} payloadSchema must be a local ref`);
    if (event['x-envelope-required']) {
      assert(Array.isArray(event['x-envelope-required']) && event['x-envelope-required'].length > 0, `${event.eventName} x-envelope-required must be a non-empty array`);
      for (const field of event['x-envelope-required']) {
        assert(typeof field === 'string' && catalog.envelope.properties?.[field], `${event.eventName} requires an unknown envelope field ${field}`);
      }
    }
    const payload = resolveJsonPointer(catalog, event.payloadSchema.$ref);
    walk(payload, (value, location) => {
      if (!isRecord(value)) return;
      for (const propertyName of Object.keys(value.properties ?? {})) {
        assert(!forbiddenFieldPatterns.some((pattern) => pattern.test(propertyName)), `${event.eventName} contains forbidden payload field ${location}.${propertyName}`);
      }
    });
    assert(isRecord(event.compatibility) && typeof event.compatibility.strategy === 'string', `${event.eventName} compatibility strategy is required`);
  }

  const asyncApiResult = validateAsyncApiProjection(catalog);

  return {
    eventCount: catalog.events.length,
    payloadSchemaCount: Object.keys(catalog.payloadSchemas).length,
    asyncApiChannelCount: asyncApiResult.channelCount,
    asyncApiOperationCount: asyncApiResult.operationCount,
  };
}

function validateSchemaRegistry(registry) {
  assert(registry.registryVersion === '1.0.0', 'JSON Schema registryVersion must be 1.0.0');
  assert(registry.schema === 'platform.json-schema.registry.v1', 'JSON Schema registry schema is invalid');
  assert(isRecord(registry.schemas) && Object.keys(registry.schemas).length > 0, 'JSON Schema registry must contain schemas');
  for (const [schemaId, schema] of Object.entries(registry.schemas)) {
    assert(/^[a-z][a-z0-9_.-]+$/.test(schemaId), `invalid JSON Schema id: ${schemaId}`);
    assert(isRecord(schema) && typeof schema.$schema === 'string' && typeof schema.$id === 'string', `${schemaId} needs $schema and $id`);
    assert(typeof schema.type === 'string' || isRecord(schema.properties) || Array.isArray(schema.oneOf), `${schemaId} must define a schema shape`);
  }
  return { schemaCount: Object.keys(registry.schemas).length };
}

export function validateContracts({ quiet = false } = {}) {
  const openApi = readJson(openApiPath);
  const catalog = readJson(eventCatalogPath);
  const schemaRegistry = readJson(schemaRegistryPath);
  const openApiResult = validateOpenApi(openApi);
  const eventResult = validateEventCatalog(catalog);
  const schemaResult = validateSchemaRegistry(schemaRegistry);
  const result = { openApi: openApiResult, events: eventResult, schemas: schemaResult, sourceFiles: [openApiPath, eventCatalogPath, schemaRegistryPath] };
  if (!quiet) {
    console.log(`Contract validation passed: ${openApiResult.operationCount} operations, ${openApiResult.schemaCount} OpenAPI schemas, ${eventResult.eventCount} events, ${eventResult.payloadSchemaCount} event payload schemas, ${eventResult.asyncApiChannelCount} AsyncAPI channels, ${eventResult.asyncApiOperationCount} AsyncAPI operations, ${schemaResult.schemaCount} JSON Schemas.`);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    if (process.argv.includes('--help')) {
      console.log('Usage: node scripts/contracts/validate-contracts.mjs [--json]');
      process.exit(0);
    }
    const result = validateContracts({ quiet: process.argv.includes('--json') });
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
