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
import { validateEventGovernance } from '../audit/p1r-event-governance-check.mjs';
import { validateEventReliability } from '../audit/p1r-event-reliability-check.mjs';
import {
  FORBIDDEN_EVENT_PAYLOAD_FIELD_PATTERNS,
  eventPayloadSchemaName,
  isForbiddenEventPayloadField,
  validateExactEventPayloadReference,
  validateFrozenEventCatalogPolicy,
} from './event-catalog-policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const openApiPath = path.join(repoRoot, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const eventCatalogPath = path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'catalog.json');
const schemaRegistryPath = path.join(repoRoot, 'packages', 'contracts', 'schemas', 'v1', 'registry.json');

const forbiddenFieldPatterns = FORBIDDEN_EVENT_PAYLOAD_FIELD_PATTERNS;

function fail(message) {
  throw new Error(`[contracts] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertExactKeys(value, keys, label) {
  assert(isRecord(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys must be exactly ${expected.join(', ')}`);
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

/**
 * The catalog embeds a canonical AsyncAPI 3.0 document rather than being a
 * standalone AsyncAPI file. Its local references intentionally resolve from
 * the catalog root (for example #/asyncapi/channels and #/payloadSchemas).
 */
export function validateAsyncApiProjection(catalog) {
  const asyncapi = catalog.asyncapi;
  assert(isRecord(asyncapi), 'embedded canonical AsyncAPI projection is required');
  assertExactKeys(asyncapi, ['asyncapi', 'info', 'x-runtime-status', 'channels', 'operations'], 'embedded AsyncAPI projection');
  assert(asyncapi.asyncapi === '3.0.0', 'embedded AsyncAPI projection must use the standard asyncapi: 3.0.0 root field');
  assert(!Object.hasOwn(asyncapi, 'version'), 'embedded AsyncAPI projection must not use the legacy version root field');
  assert(isRecord(asyncapi.info), 'AsyncAPI projection info is required');
  assertExactKeys(asyncapi.info, ['title', 'version', 'description'], 'AsyncAPI projection info');
  assert(asyncapi.info.title === '语学星 v2 平台集成事件', 'AsyncAPI projection must use the platform-level title');
  assert(asyncapi.info.version === catalog.catalogVersion, 'AsyncAPI info.version must match catalogVersion');
  assert(typeof asyncapi.info.description === 'string' && asyncapi.info.description.length > 0, 'AsyncAPI platform description is required');
  assert(isRecord(asyncapi.channels), 'AsyncAPI projection channels are required');
  assert(isRecord(asyncapi.operations), 'AsyncAPI projection operations are required');
  assert(asyncapi['x-runtime-status'] === 'NOT_RUNTIME_VERIFIED', 'AsyncAPI projection must remain NOT_RUNTIME_VERIFIED');

  const canonicalEvents = catalog.events.filter((event) => event.status === 'CANONICAL_D2');
  const eventsByName = new Map(canonicalEvents.map((event) => [event.eventName, event]));
  const channelEntries = Object.entries(asyncapi.channels);
  const operationEntries = Object.entries(asyncapi.operations);
  const expectedOperationCount = canonicalEvents.reduce((total, event) => total + 1 + event['x-p1r-governance'].consumers.length, 0);
  assert(channelEntries.length === canonicalEvents.length, 'AsyncAPI must project exactly one channel per CANONICAL_D2 event');
  assert(operationEntries.length === expectedOperationCount, 'AsyncAPI must project one send and every governed receive operation');

  const channelKeys = new Set();
  const channelByEventName = new Map();
  const channelDetailsByReference = new Map();
  for (const [channelKey, channel] of channelEntries) {
    assert(!channelKeys.has(channelKey), `duplicate AsyncAPI channel key ${channelKey}`);
    channelKeys.add(channelKey);
    assert(isRecord(channel), `AsyncAPI channel ${channelKey} must be an object`);
    assertExactKeys(channel, ['address', 'bindings', 'messages'], `AsyncAPI channel ${channelKey}`);
    assert(typeof channel.address === 'string' && channel.address.length > 0, `AsyncAPI channel ${channelKey} needs a concrete address`);
    const messageEntries = Object.entries(channel.messages ?? {});
    assert(messageEntries.length === 1, `AsyncAPI channel ${channelKey} must expose exactly one event message`);
    const [messageKey, message] = messageEntries[0];
    assert(isRecord(message) && !Object.hasOwn(message, '$ref'), `AsyncAPI channel ${channelKey} message ${messageKey} must be a Message Object, not a schema reference`);
    assertExactKeys(message, ['name', 'x-event-name', 'payload', 'bindings'], `AsyncAPI channel ${channelKey} message ${messageKey}`);
    const eventName = message['x-event-name'] ?? message.name;
    assert(typeof eventName === 'string' && eventsByName.has(eventName), `AsyncAPI channel ${channelKey} message ${messageKey} has an orphan event identifier`);
    assert(message.name === eventName && message['x-event-name'] === eventName, `AsyncAPI channel ${channelKey} message ${messageKey} must explicitly identify ${eventName}`);
    assert(!channelByEventName.has(eventName), `AsyncAPI event ${eventName} has duplicate channels`);

    const event = eventsByName.get(eventName);
    const governance = event['x-p1r-governance'];
    assert(channelKey === governance.transport.channelId, `AsyncAPI channel ${channelKey} must use the governed channelId for ${eventName}`);
    assert(channel.address === governance.transport.topic, `AsyncAPI channel ${channelKey} address must match ${eventName} Kafka topic`);
    assertExactKeys(channel.bindings, ['kafka'], `AsyncAPI channel ${channelKey} bindings`);
    const kafkaBinding = channel.bindings?.kafka;
    assertExactKeys(kafkaBinding, ['topic', 'bindingVersion'], `AsyncAPI channel ${channelKey} Kafka binding`);
    assert(kafkaBinding.topic === channel.address, `AsyncAPI channel ${channelKey} Kafka binding topic must equal its address`);
    assert(kafkaBinding.bindingVersion === governance.transport.bindingVersion, `AsyncAPI channel ${channelKey} Kafka bindingVersion must match governance`);
    assertExactKeys(message.payload, ['$ref'], `AsyncAPI channel ${channelKey} message payload`);
    assert(isRecord(message.payload) && typeof message.payload.$ref === 'string', `AsyncAPI channel ${channelKey} message ${messageKey} payload must be a local schema reference`);
    assert(message.payload.$ref === event.payloadSchema.$ref, `AsyncAPI channel ${channelKey} payload must match ${event.eventName}`);
    assertExactKeys(message.bindings, ['kafka'], `AsyncAPI channel ${channelKey} message bindings`);
    assertExactKeys(message.bindings?.kafka, ['key', 'bindingVersion'], `AsyncAPI channel ${channelKey} message Kafka binding`);
    assert(message.bindings.kafka.bindingVersion === governance.transport.bindingVersion, `AsyncAPI channel ${channelKey} message bindingVersion must match governance`);
    assertExactKeys(message.bindings.kafka.key, ['type', 'description'], `AsyncAPI channel ${channelKey} Kafka key`);
    assert(message.bindings.kafka.key?.type === 'string', `AsyncAPI channel ${channelKey} Kafka key must be a string schema`);
    assertRefsResolve(catalog, message, `AsyncAPI channel ${channelKey} message ${messageKey}`);

    channelByEventName.set(eventName, channelKey);
    const channelReference = `#/asyncapi/channels/${encodeJsonPointerToken(channelKey)}`;
    channelDetailsByReference.set(channelReference, {
      channelKey,
      event,
      governance,
      messageReference: `#/asyncapi/channels/${encodeJsonPointerToken(channelKey)}/messages/${encodeJsonPointerToken(messageKey)}`,
    });
  }
  assert(channelByEventName.size === canonicalEvents.length, 'every CANONICAL_D2 event must have one AsyncAPI channel');

  const sendOperationsByChannel = new Map();
  const receiveOperationsByChannel = new Map();
  for (const [operationKey, operation] of operationEntries) {
    assert(isRecord(operation), `AsyncAPI operation ${operationKey} must be an object`);
    assert(operation.action === 'send' || operation.action === 'receive', `AsyncAPI operation ${operationKey} action must be send or receive`);
    const channelReference = operation.channel?.$ref;
    assertExactKeys(operation.channel, ['$ref'], `AsyncAPI operation ${operationKey} channel reference`);
    assert(typeof channelReference === 'string', `AsyncAPI operation ${operationKey} must reference a channel`);
    const detail = channelDetailsByReference.get(channelReference);
    assert(detail, `AsyncAPI operation ${operationKey} references an orphan channel`);
    assert(Array.isArray(operation.messages) && operation.messages.length === 1, `AsyncAPI operation ${operationKey} must reference exactly one event message`);
    assertExactKeys(operation.messages[0], ['$ref'], `AsyncAPI operation ${operationKey} message reference`);
    assert(operation.messages[0]?.$ref === detail.messageReference, `AsyncAPI operation ${operationKey} message must match channel ${detail.channelKey}`);
    const kafkaBinding = operation.bindings?.kafka;
    assertExactKeys(operation.bindings, ['kafka'], `AsyncAPI operation ${operationKey} bindings`);
    if (operation.action === 'send') {
      assertExactKeys(operation, ['action', 'channel', 'messages', 'bindings', 'x-producer-service', 'x-data-owner'], `AsyncAPI send operation ${operationKey}`);
      assert(operationKey === detail.governance.producer.publishOperationId, `AsyncAPI send operation ${operationKey} must match producer governance`);
      assert(operation['x-producer-service'] === detail.governance.producer.service, `AsyncAPI send operation ${operationKey} producer service mismatch`);
      assert(operation['x-data-owner'] === detail.governance.producer.dataOwner, `AsyncAPI send operation ${operationKey} data owner mismatch`);
      assertExactKeys(kafkaBinding, ['bindingVersion'], `AsyncAPI send operation ${operationKey} Kafka binding`);
      assert(kafkaBinding.bindingVersion === detail.governance.transport.bindingVersion, `AsyncAPI send operation ${operationKey} bindingVersion mismatch`);
      sendOperationsByChannel.set(detail.channelKey, (sendOperationsByChannel.get(detail.channelKey) ?? 0) + 1);
    } else {
      assertExactKeys(operation, ['action', 'channel', 'messages', 'bindings', 'x-consumer-service'], `AsyncAPI receive operation ${operationKey}`);
      const consumer = detail.governance.consumers.find((candidate) => candidate.subscriptionOperationId === operationKey);
      assert(consumer, `AsyncAPI receive operation ${operationKey} has no governed consumer`);
      assert(operation['x-consumer-service'] === consumer.service, `AsyncAPI receive operation ${operationKey} consumer service mismatch`);
      assertExactKeys(kafkaBinding, ['groupId', 'bindingVersion'], `AsyncAPI receive operation ${operationKey} Kafka binding`);
      assert(kafkaBinding.bindingVersion === detail.governance.transport.bindingVersion, `AsyncAPI receive operation ${operationKey} bindingVersion mismatch`);
      assert(kafkaBinding.groupId?.type === 'string' && JSON.stringify(kafkaBinding.groupId.enum) === JSON.stringify([consumer.consumerGroup]), `AsyncAPI receive operation ${operationKey} consumer group mismatch`);
      assertExactKeys(kafkaBinding.groupId, ['type', 'enum'], `AsyncAPI receive operation ${operationKey} groupId`);
      const received = receiveOperationsByChannel.get(detail.channelKey) ?? new Set();
      assert(!received.has(consumer.consumerGroup), `AsyncAPI channel ${detail.channelKey} duplicates consumer group ${consumer.consumerGroup}`);
      received.add(consumer.consumerGroup);
      receiveOperationsByChannel.set(detail.channelKey, received);
    }
    assertRefsResolve(catalog, operation, `AsyncAPI operation ${operationKey}`);
  }
  for (const [eventName, channelKey] of channelByEventName) {
    const event = eventsByName.get(eventName);
    assert(sendOperationsByChannel.get(channelKey) === 1, `AsyncAPI channel ${channelKey} must have exactly one send operation`);
    assert(receiveOperationsByChannel.get(channelKey)?.size === event['x-p1r-governance'].consumers.length, `AsyncAPI channel ${channelKey} must project every governed consumer`);
  }

  assertRefsResolve(catalog, asyncapi, 'embedded AsyncAPI projection');
  return { channelCount: channelEntries.length, operationCount: operationEntries.length };
}

export function validateOpenApi(document) {
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
        const failClosed = operation['x-fail-closed'];
        if (isRecord(failClosed)) {
          // This endpoint cannot mint a verified PUT grant. A fabricated replay
          // contract would imply a success path and hide the missing owner flow.
          assert(method === 'post' && route === '/api/v1/media/assets/{assetId}/upload-url',
            `${method.toUpperCase()} ${route} cannot claim a fail-closed write exception`);
          assertExactKeys(failClosed, ['mode', 'sideEffects', 'eligibleRequestStatus', 'reason'],
            `${operation.operationId} x-fail-closed`);
          assert(failClosed.mode === 'NO_SUCCESS_PATH' && failClosed.sideEffects === false
            && failClosed.eligibleRequestStatus === 503
            && failClosed.reason === 'MEDIA_UPLOAD_PUT_GRANT_UNAVAILABLE',
          `${operation.operationId} must declare the exact no-side-effect upload failure`);
          assert(operation['x-contract']?.runtimeStatus === 'FAIL_CLOSED_UPLOAD_NOT_CONFIGURED',
            `${operation.operationId} must remain marked fail closed`);
          assert(!Object.hasOwn(operation, 'x-idempotency'),
            `${operation.operationId} cannot claim durable idempotency while disabled`);
          assert(isRecord(operation.responses?.['503'])
            && !Object.keys(operation.responses).some((status) => /^2\d\d$/.test(status)),
          `${operation.operationId} must expose 503 without a success response`);
        } else {
          assert(isRecord(operation['x-idempotency']), `${method.toUpperCase()} ${route} needs x-idempotency declaration`);
          assert(typeof operation['x-idempotency'].strategy === 'string', `${operation.operationId} x-idempotency.strategy is required`);
          assert(typeof operation['x-idempotency'].replayBehavior === 'string', `${operation.operationId} x-idempotency.replayBehavior is required`);
        }
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

export function validateEventCatalog(catalog) {
  const frozenPolicyErrors = validateFrozenEventCatalogPolicy(catalog);
  assert(frozenPolicyErrors.length === 0, frozenPolicyErrors.join('\n'));
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
  const referencedPayloadSchemas = new Set();
  for (const event of catalog.events) {
    assert(isRecord(event), 'event entry must be an object');
    assert(typeof event.eventName === 'string' && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+\.v[0-9]+$/.test(event.eventName), `invalid eventName: ${event.eventName}`);
    assert(!names.has(event.eventName), `duplicate eventName: ${event.eventName}`);
    names.add(event.eventName);
    const versionMatch = event.eventName.match(/\.v([0-9]+)$/);
    assert(Number(event.version) === Number(versionMatch[1]), `${event.eventName} version must match eventName suffix`);
    assert(typeof event.domain === 'string' && /^[a-z][a-z0-9_]*$/.test(event.domain), `${event.eventName} domain is invalid`);
    assert(typeof event.aggregateType === 'string' && /^[a-z][a-z0-9_]{1,63}$/.test(event.aggregateType), `${event.eventName} aggregateType is invalid`);
    const payloadReferenceErrors = validateExactEventPayloadReference(event.payloadSchema, catalog.payloadSchemas, `${event.eventName} payloadSchema`);
    assert(payloadReferenceErrors.length === 0, payloadReferenceErrors.join('\n'));
    referencedPayloadSchemas.add(eventPayloadSchemaName(event.payloadSchema));
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
        assert(!isForbiddenEventPayloadField(propertyName), `${event.eventName} contains forbidden payload field ${location}.${propertyName}`);
      }
    });
    assert(isRecord(event.compatibility) && typeof event.compatibility.strategy === 'string', `${event.eventName} compatibility strategy is required`);
  }
  for (const schemaName of Object.keys(catalog.payloadSchemas)) {
    assert(referencedPayloadSchemas.has(schemaName), `event payload schema ${schemaName} must be referenced by at least one catalog event`);
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
  const eventGovernanceResult = validateEventGovernance({ root: repoRoot });
  assert(
    eventGovernanceResult.result === 'PASS',
    `event governance failed:\n${eventGovernanceResult.errors.join('\n')}`,
  );
  const eventReliabilityResult = validateEventReliability({ root: repoRoot });
  assert(
    eventReliabilityResult.result === 'PASS',
    `event reliability failed:\n${eventReliabilityResult.errors.join('\n')}`,
  );
  const openApiResult = validateOpenApi(openApi);
  const eventResult = validateEventCatalog(catalog);
  const schemaResult = validateSchemaRegistry(schemaRegistry);
  const result = {
    openApi: openApiResult,
    events: {
      ...eventResult,
      governance: eventGovernanceResult.summary,
      reliability: eventReliabilityResult.summary,
    },
    schemas: schemaResult,
    runtimeStatus: eventGovernanceResult.summary.runtimeStatus,
    sourceFiles: [
      openApiPath,
      eventCatalogPath,
      schemaRegistryPath,
      path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'reliability-policy.json'),
      path.join(repoRoot, 'config', 'p1r-saga-recovery.v1.json'),
    ],
  };
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
