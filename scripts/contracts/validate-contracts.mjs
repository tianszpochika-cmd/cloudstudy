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
  assert(document['x-b8-authentication']?.accessToken?.algorithm === 'RS256' || document['x-b8-authentication']?.accessToken?.algorithm === 'ES256', 'JWT algorithm must be RS256 or ES256');
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
  if (catalog.asyncapi) {
    assert(catalog.asyncapi.version === '3.0.0', 'AsyncAPI projection must use version 3.0.0');
    assert(isRecord(catalog.asyncapi.info), 'AsyncAPI projection info is required');
    assert(isRecord(catalog.asyncapi.channels) && Object.keys(catalog.asyncapi.channels).length > 0, 'AsyncAPI projection channels are required');
    assertRefsResolve(catalog, catalog.asyncapi, 'AsyncAPI projection');
  }

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

  return { eventCount: catalog.events.length, payloadSchemaCount: Object.keys(catalog.payloadSchemas).length };
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
    console.log(`Contract validation passed: ${openApiResult.operationCount} operations, ${openApiResult.schemaCount} OpenAPI schemas, ${eventResult.eventCount} events, ${eventResult.payloadSchemaCount} event payload schemas, ${schemaResult.schemaCount} JSON Schemas.`);
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
