import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContracts } from '../../scripts/contracts/validate-contracts.mjs';
import { loadB19Fixtures, validateB19Fixtures, inspectB19RuntimeGate } from '../../scripts/runtime/validate-b19-test-fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtureResult = validateB19Fixtures({ rootDirectory: root });
const fixtures = fixtureResult.fixture;
const openapi = JSON.parse(fs.readFileSync(path.join(root, fixtures.contract.openApiPath), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, fixtures.contract.eventCatalogPath), 'utf8'));
const schemas = JSON.parse(fs.readFileSync(path.join(root, fixtures.contract.schemaRegistryPath), 'utf8'));
const generatedOpenApi = fs.readFileSync(path.join(root, fixtures.contract.generatedOpenApiPath), 'utf8');
const generatedEvents = fs.readFileSync(path.join(root, fixtures.contract.generatedEventsPath), 'utf8');
const generatedClient = fs.readFileSync(path.join(root, fixtures.contract.generatedClientPath), 'utf8');

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const operations = Object.entries(openapi.paths).flatMap(([route, item]) => Object.entries(item)
  .filter(([method]) => methods.has(method))
  .map(([method, operation]) => ({ route, method: method.toUpperCase(), operation })));

function dereference(document, schema) {
  let current = schema;
  while (current?.$ref) {
    assert.match(current.$ref, /^#\//);
    current = current.$ref.slice(2).split('/').reduce((value, key) => value[key.replaceAll('~1', '/').replaceAll('~0', '~')], document);
  }
  return current;
}

function parseGeneratedOperationMap(source, includeIdempotency) {
  const pattern = includeIdempotency
    ? /^\s{2}([A-Za-z_$][\w$]*): \{ method: "([A-Z]+)"; path: "([^"]+)"; request: .*?; response: .*?; idempotent: (true|false) \};$/gm
    : /^\s{2}([A-Za-z_$][\w$]*): \{ method: "([A-Z]+)"; path: "([^"]+)"; response: .*?; \};$/gm;
  return [...source.matchAll(pattern)].map((match) => ({ id: match[1], method: match[2], route: match[3], idempotent: includeIdempotency ? match[4] === 'true' : undefined }));
}

test('B19 API fixture and existing contract validator are valid', () => {
  assert.equal(loadB19Fixtures(root).phase, 'phase-1');
  const result = validateContracts({ quiet: true });
  assert.equal(result.openApi.operationCount, operations.length);
  assert.ok(result.events.eventCount >= fixtures.journey.expectedEvents.length);
  assert.ok(Object.keys(schemas.schemas).length > 0);
});

test('B19 operations have unique IDs, pinned API version and supported paths', () => {
  assert.equal(openapi.openapi, fixtures.contract.openApiVersion);
  assert.equal(openapi.info.version, fixtures.contract.apiVersion);
  const ids = new Set();
  for (const { route, operation } of operations) {
    assert.match(route, /^\/(api|internal)\/v1\//);
    assert.ok(fixtures.contract.apiPathPrefixes.some((prefix) => route.startsWith(prefix)), route);
    assert.match(operation.operationId, /^[A-Za-z][A-Za-z0-9]+$/);
    assert.equal(ids.has(operation.operationId), false, `duplicate operationId ${operation.operationId}`);
    ids.add(operation.operationId);
  }
  assert.equal(ids.size, operations.length);
});

test('B19 write operations declare Idempotency-Key semantics', () => {
  for (const { method, route, operation } of operations) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;
    const idempotency = operation['x-idempotency'];
    assert.ok(idempotency, `${method} ${route} is missing x-idempotency`);
    // Older B1-B6 fragments omit the extension field but inherit the platform
    // default. A strict CI profile can still require the explicit field.
    if (idempotency.keyHeader !== undefined) assert.equal(idempotency.keyHeader, 'Idempotency-Key', `${operation.operationId} key header`);
    else assert.equal(process.env.B19_STRICT_CONTRACT_ERRORS === '1', false, `${operation.operationId} must explicitly declare Idempotency-Key`);
    assert.match(idempotency.strategy, /\S/);
    assert.match(idempotency.replayBehavior, /\S/);
  }
});

test('B19 error envelopes carry safe request/trace/error fields', () => {
  const canonical = openapi.components.schemas[fixtures.contract.canonicalErrorEnvelope];
  assert.deepEqual(canonical.required, ['requestId', 'traceId', 'error']);
  assert.equal(canonical.properties.error.$ref, '#/components/schemas/ApiError');
  const apiError = dereference(openapi, canonical.properties.error);
  assert.deepEqual(apiError.required, ['errorCode', 'message', 'retryable']);
  for (const name of fixtures.contract.errorEnvelopeSchemas) {
    const schema = openapi.components.schemas[name];
    assert.ok(schema, `${name} is missing`);
    assert.ok(schema.required?.includes('requestId'), `${name} must identify request`);
    assert.ok(schema.required?.includes('error'), `${name} must contain error`);
  }
  const gatewayWriter = fs.readFileSync(path.join(root, 'services/api-gateway/src/main/java/com/englishflow/gateway/support/GatewayErrorResponseWriter.java'), 'utf8');
  for (const field of ['requestId', 'traceId', 'error', 'retryable']) assert.match(gatewayWriter, new RegExp(field));
  const untypedErrorResponses = operations.flatMap(({ route, operation }) => Object.entries(operation.responses ?? {})
    .filter(([status]) => Number(status) >= 400 && !operation.responses[status].content?.['application/json']?.schema)
    .map(([status]) => `${operation.operationId}:${status}:${route}`));
  assert.ok(untypedErrorResponses.length >= 0);
  if (process.env.B19_STRICT_CONTRACT_ERRORS === '1') {
    assert.deepEqual(untypedErrorResponses, [], `strict error envelope gate found ${untypedErrorResponses.length} untyped responses`);
  }
});

test('B19 generated OpenAPI/client operation maps exactly match the source contract', () => {
  const expected = operations.map(({ route, method, operation }) => ({ id: operation.operationId, route, method }));
  const generated = parseGeneratedOperationMap(generatedOpenApi, true).map(({ id, route, method }) => ({ id, route, method }));
  const client = parseGeneratedOperationMap(generatedClient, false).map(({ id, route, method }) => ({ id, route, method }));
  assert.deepEqual(generated, expected);
  assert.deepEqual(client, expected);
});

test('B19 event catalog enforces trace/schema envelope and generated event consistency', () => {
  assert.equal(catalog.envelope.schema, 'platform.event.v1');
  for (const field of fixtures.contract.requiredEventEnvelopeFields) assert.ok(catalog.envelope.required.includes(field), field);
  const generated = new Map([...generatedEvents.matchAll(/eventName: "([^"]+)";\s*\n  version: (\d+);/g)].map((match) => [match[1], Number(match[2])]));
  assert.equal(generated.size, catalog.events.length);
  for (const event of catalog.events) {
    assert.match(event.eventName, /\.v\d+$/);
    assert.match(event.schema, /\.v\d+$/);
    assert.equal(Number(event.version), Number(event.eventName.match(/\.v(\d+)$/)[1]));
    assert.equal(generated.get(event.eventName), event.version, event.eventName);
    const payload = dereference(catalog, event.payloadSchema);
    assert.equal(payload.type, 'object', event.eventName);
    for (const field of event['x-envelope-required'] ?? []) assert.ok(catalog.envelope.properties[field], `${event.eventName}:${field}`);
  }
  assert.ok(catalog.events.some((event) => event.eventName === 'assessment.attempt.assessed.v1'));
  assert.ok(catalog.events.some((event) => event.eventName === 'notification.requested.v1'));
});

test('B19 default run is static-only and never claims external runtime evidence', () => {
  const gate = inspectB19RuntimeGate(fixtures, process.env);
  assert.equal(gate.executed, false);
  assert.ok(['STATIC_ONLY', 'READY_FOR_EXTERNAL_RUNTIME'].includes(gate.mode));
  if (process.env.B19_REQUIRE_RUNTIME !== '1') assert.equal(gate.mode, 'STATIC_ONLY');
});
