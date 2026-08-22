import test from 'node:test';
import assert from 'node:assert/strict';
import { compareContracts } from '../../scripts/contracts/compatibility-diff.mjs';

function openApiWith({ required = ['id'], includeRoute = true } = {}) {
  return {
    openapi: '3.0.3',
    paths: includeRoute ? {
      '/api/v1/example': {
        post: {
          requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ExampleRequest' } } } },
          responses: { 200: { description: 'ok' } },
        },
      },
    } : {},
    components: {
      schemas: {
        ExampleRequest: { type: 'object', required, properties: { id: { type: 'string' }, label: { type: 'string' } } },
      },
    },
  };
}

test('OpenAPI compatibility allows optional request fields', () => {
  const previous = openApiWith();
  const current = openApiWith();
  current.components.schemas.ExampleRequest.properties.optional = { type: 'string' };
  assert.deepEqual(compareContracts('openapi', previous, current), []);
});

test('OpenAPI compatibility rejects route removal and new required fields', () => {
  const previous = openApiWith();
  const current = openApiWith({ required: ['id', 'newRequired'] });
  current.paths = {};
  const changes = compareContracts('openapi', previous, current);
  assert.ok(changes.some((change) => change.reason === 'existing route removed'));
  assert.ok(changes.some((change) => change.reason === 'new required field: newRequired'));
});

test('event compatibility rejects removing an existing event', () => {
  const previous = {
    events: [{ eventName: 'example.created.v1', version: 1, payloadSchema: { $ref: '#/payloadSchemas/Example' } }],
    payloadSchemas: { Example: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  };
  const current = { events: [], payloadSchemas: {} };
  const changes = compareContracts('events', previous, current);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].reason, 'existing event removed');
});

test('JSON Schema compatibility rejects narrowing an enum', () => {
  const previous = { schemas: { Example: { type: 'string', enum: ['a', 'b'] } } };
  const current = { schemas: { Example: { type: 'string', enum: ['a'] } } };
  const changes = compareContracts('schema', previous, current);
  assert.equal(changes.length, 1);
  assert.match(changes[0].reason, /enum value removed/);
});
