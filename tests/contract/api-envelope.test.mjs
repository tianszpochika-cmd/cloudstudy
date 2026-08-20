import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertApiEnvelope,
  createApiErrorEnvelope,
  createApiSuccessEnvelope,
} from '../../packages/telemetry/src/index.mjs';

const requestId = 'req_test_0001';
const traceId = 'trace_test_0001';

test('success envelope follows requestId/data/meta/serverTime contract', () => {
  const envelope = createApiSuccessEnvelope({
    requestId,
    traceId,
    data: { status: 'ok' },
    meta: { cursor: null },
  });

  assertApiEnvelope(envelope);
  assert.equal(envelope.requestId, requestId);
  assert.equal(envelope.traceId, traceId);
  assert.deepEqual(envelope.data, { status: 'ok' });
  assert.deepEqual(envelope.meta, { cursor: null });
});

test('error envelope exposes stable code and never accepts sensitive details', () => {
  const envelope = createApiErrorEnvelope({
    requestId,
    code: 'ACCESS_DENIED',
    message: '无权访问该资源',
    details: { reasonCode: 'TENANT_OR_RESOURCE_SCOPE_DENIED' },
  });

  assertApiEnvelope(envelope);
  assert.equal(envelope.error.code, 'ACCESS_DENIED');
  assert.throws(
    () => createApiErrorEnvelope({ requestId, code: 'ACCESS_DENIED', message: '拒绝', details: { accessToken: 'Bearer synthetic-token-value' } }),
    (error) => error.code === 'API_ERROR_DETAILS_SENSITIVE_DATA',
  );
});

test('envelope rejects ambiguous or malformed success/error shapes', () => {
  assert.throws(
    () => assertApiEnvelope({ requestId, data: {}, error: { code: 'BAD_REQUEST', message: 'bad' } }),
    (error) => error.code === 'INVALID_ENVELOPE_SHAPE',
  );
  assert.throws(
    () => assertApiEnvelope({ requestId, data: {} }),
    (error) => error.code === 'INVALID_SERVER_TIME',
  );
  assert.throws(
    () => createApiErrorEnvelope({ requestId, code: 'bad-code', message: 'bad' }),
    (error) => error.code === 'INVALID_ERROR_CODE',
  );
});
