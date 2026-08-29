import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { validateApiContractData } from '../../scripts/audit/p1r-api-contract-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const openApi = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json'), 'utf8'));
const schemaRegistry = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'contracts', 'schemas', 'v1', 'registry.json'), 'utf8'));
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const canonicalErrors = {
  400: 'ApiBadRequest',
  401: 'ApiUnauthorized',
  403: 'ApiForbidden',
  404: 'ApiNotFound',
  409: 'ApiConflict',
  422: 'ApiUnprocessableEntity',
  429: 'ApiRateLimited',
  500: 'ApiInternalError',
  503: 'ApiServiceUnavailable',
  504: 'ApiGatewayTimeout',
};

function canonicalFixture() {
  const document = structuredClone(openApi);
  for (const [route, pathItem] of Object.entries(document.paths)) {
    if (!route.startsWith('/api/v1/')) continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!methods.has(method)) continue;
      for (const [status, responseName] of Object.entries(canonicalErrors)) {
        if (status in operation.responses) operation.responses[status] = { $ref: `#/components/responses/${responseName}` };
      }
      for (const status of Object.keys(operation.responses)) {
        if (!/^2\d\d$/.test(status)) continue;
        const cursorPaginated = String(operation.operationId ?? '').startsWith('list')
          || [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
            .some((parameter) => parameter?.$ref === '#/components/parameters/Cursor');
        operation.responses[status] = {
          description: 'canonical fixture response',
          headers: {
            'X-Request-Id': { $ref: '#/components/headers/XRequestId' },
            'X-Trace-Id': { $ref: '#/components/headers/XTraceId' },
            'X-API-Version': { $ref: '#/components/headers/XApiVersion' },
          },
          content: {
            'application/json': {
              schema: {
                $ref: cursorPaginated
                  ? '#/components/schemas/ApiCursorPageEnvelope'
                  : '#/components/schemas/ApiSuccessEnvelope',
              },
            },
          },
        };
      }
    }
  }
  return document;
}

function validateChanged(mutate) {
  const changedOpenApi = canonicalFixture();
  const changedRegistry = structuredClone(schemaRegistry);
  mutate(changedOpenApi, changedRegistry);
  return validateApiContractData({ openApi: changedOpenApi, schemaRegistry: changedRegistry }).errors;
}

test('canonical external API fixture passes the P1R governance gate', () => {
  const report = validateApiContractData({ openApi: canonicalFixture(), schemaRegistry });
  assert.deepEqual(report.errors, []);
  assert(report.summary.operationCount > 300);
  assert(report.summary.externalWriteCount > 100);
  assert.equal(report.summary.idempotencyExceptionCount, 1);
  assert.equal(report.summary.listOperationCount, 58);
  assert.equal(report.summary.cursorPaginatedOperationCount, 60);
});

test('missing canonical error response and correlation headers fail closed', () => {
  const errors = validateChanged((document) => {
    delete document.components.responses.ApiForbidden;
    delete document.components.responses.ApiRateLimited.headers['X-Trace-Id'];
  });
  assert(errors.some((error) => error.includes('missing canonical HTTP 403 response')));
  assert(errors.some((error) => error.includes('ApiRateLimited must expose correlation')));
});

test('each declared external standard error response and JSON success response use canonical envelopes', () => {
  const errors = validateChanged((document) => {
    const operation = document.paths['/api/v1/content'].post;
    operation.responses[403] = { $ref: '#/components/responses/B1Forbidden' };
    operation.responses[201].content['application/json'].schema = { $ref: '#/components/schemas/B1ContentVersion' };
    delete operation.responses[201].headers['X-Trace-Id'];
  });
  assert(errors.some((error) => error.includes('POST /api/v1/content responses.403 must reference #/components/responses/ApiForbidden')));
  assert(errors.some((error) => error.includes('POST /api/v1/content responses.201 must use ApiSuccessEnvelope or ApiCursorPageEnvelope')));
  assert(errors.some((error) => error.includes('POST /api/v1/content responses.201 must expose correlation and API version headers')));
});

test('canonical oneOf success/page envelope extensions remain valid', () => {
  const errors = validateChanged((document) => {
    document.paths['/api/v1/health'].get.responses[200].content['application/json'].schema = {
      oneOf: [
        { $ref: '#/components/schemas/ApiSuccessEnvelope' },
        { $ref: '#/components/schemas/ApiCursorPageEnvelope' },
      ],
    };
  });
  assert.deepEqual(errors, []);
});

test('external writes require a bound Idempotency-Key and exactly one named signed-access exception', () => {
  const errors = validateChanged((document) => {
    const operation = document.paths['/api/v1/onboarding/profile'].post;
    operation['x-idempotency'].required = true;
    operation.parameters = [];
    const signedAccess = document.paths['/api/v1/content/media/{mediaAssetId}/signed-access'].post;
    delete signedAccess['x-p1r-idempotency-exception'];
  });
  assert(errors.some((error) => error.includes('POST /api/v1/onboarding/profile must reference a required Idempotency-Key')));
  assert(errors.some((error) => error.includes('optional idempotency needs x-p1r-idempotency-exception')));
});

test('all list operations fail closed without canonical cursor pagination and meta-only cursor state', () => {
  const errors = validateChanged((document) => {
    const operation = document.paths['/api/v1/commerce/orders'].get;
    operation.parameters = [{ $ref: '#/components/parameters/B13PageLimit' }];
    delete operation['x-pagination'];
    operation.responses[200].content['application/json'].schema = {
      allOf: [
        { $ref: '#/components/schemas/ApiSuccessEnvelope' },
        {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                items: { type: 'array', items: { type: 'object' } },
                nextCursor: { type: ['string', 'null'] },
              },
            },
          },
        },
      ],
    };
  });
  assert(errors.some((error) => error.includes('GET /api/v1/commerce/orders must declare x-pagination')));
  assert(errors.some((error) => error.includes('must reference canonical Cursor exactly once')));
  assert(errors.some((error) => error.includes('must reference canonical PageSize exactly once')));
  assert(errors.some((error) => error.includes('retains a legacy cursor/page/limit parameter')));
  assert(errors.some((error) => error.includes('responses.200 must use ApiCursorPageEnvelope')));
  assert(errors.some((error) => error.includes('cursor/page state only in ApiCursorPageMeta')));
});

test('a second otherwise valid idempotency exception fails closed', () => {
  const errors = validateChanged((document) => {
    const operation = document.paths['/api/v1/onboarding/profile'].post;
    operation['x-idempotency'] = { ...operation['x-idempotency'], required: false };
    operation['x-p1r-idempotency-exception'] = {
      rule: 'writeIdempotency',
      reason: 'negative test',
      owner: 'test-owner',
      safeBehavior: 'negative test only',
    };
  });
  assert(errors.some((error) => error.includes('POST /api/v1/onboarding/profile is not the sole allowed signed-access idempotency exception')));
  assert(errors.some((error) => error.includes('exactly one signed-access idempotency exception is required; found 2')));
});

test('unversioned paths and incomplete deprecation declarations fail closed', () => {
  const errors = validateChanged((document) => {
    document.paths['/learner/profile'] = {
      get: { operationId: 'unversionedProfile', responses: { 200: { description: 'invalid fixture' } } },
    };
    const operation = document.paths['/api/v1/health'].get;
    operation.deprecated = true;
  });
  assert(errors.some((error) => error.includes('path is outside versioned boundaries')));
  assert(errors.some((error) => error.includes('deprecated operation needs x-p1r-deprecation')));
});

test('schema registry cannot drop the canonical envelope', () => {
  const errors = validateChanged((_document, registry) => {
    delete registry.schemas['platform.api.envelope.v1'];
  });
  assert(errors.some((error) => error.includes('schema registry must contain platform.api.envelope.v1')));
});
