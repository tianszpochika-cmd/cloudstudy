import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTelemetryEnvelope,
  findSensitiveData,
  sanitizeTelemetryEvent,
} from '../../packages/telemetry/src/index.mjs';

const baseEvent = {
  eventName: 'practice.submitted.v1',
  eventVersion: '1.0.0',
  environment: 'test',
  source: 'api',
  requestId: 'req_test_0001',
  traceId: 'trace_test_0001',
  correlationId: 'corr_test_0001',
  actorId: 'user_test_0001',
  tenantId: 'tenant_test_0001',
  payload: {
    schema: 'practice.submitted',
    practiceId: 'practice_test_0001',
    itemId: 'item_test_0001',
    itemType: 'choice',
    resultBand: 'pass',
    durationMs: 1200,
  },
};

test('telemetry envelope contains correlation IDs and registered payload fields', () => {
  const event = createTelemetryEnvelope(baseEvent);

  assert.match(event.eventId, /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
  assert.equal(event.requestId, baseEvent.requestId);
  assert.equal(event.traceId, baseEvent.traceId);
  assert.equal(event.correlationId, baseEvent.correlationId);
  assert.equal(event.actorId, baseEvent.actorId);
  assert.equal(event.tenantId, baseEvent.tenantId);
  assert.equal(event.payload.schema, 'practice.submitted');
});

test('telemetry defaults anonymous actor/tenant to null but still creates request and trace IDs', () => {
  const event = createTelemetryEnvelope({
    eventName: 'telemetry.error.v1',
    payload: {
      schema: 'telemetry.error',
      errorCode: 'UPSTREAM_TIMEOUT',
      category: 'dependency',
      retryable: true,
    },
  });

  assert.equal(event.actorId, null);
  assert.equal(event.tenantId, null);
  assert.notEqual(event.requestId, event.traceId);
});

test('unregistered payload fields and event versions are rejected by default', () => {
  assert.throws(
    () => createTelemetryEnvelope({ ...baseEvent, payload: { ...baseEvent.payload, rawNote: 'not registered' } }),
    (error) => error.code === 'PAYLOAD_FIELD_NOT_ALLOWED',
  );
  assert.throws(
    () => createTelemetryEnvelope({ ...baseEvent, eventName: 'practice.submitted.v2' }),
    (error) => error.code === 'EVENT_NOT_REGISTERED',
  );
});

test('password, token, raw audio and payment credentials are blocked before emission', () => {
  for (const sensitiveField of ['password', 'accessToken', 'rawAudio', 'paymentCredential']) {
    assert.throws(
      () => createTelemetryEnvelope({ ...baseEvent, payload: { ...baseEvent.payload, [sensitiveField]: 'synthetic-secret' } }),
      (error) => error.code === 'SENSITIVE_FIELD_FORBIDDEN',
    );
  }
  assert.throws(
    () => createTelemetryEnvelope({ ...baseEvent, payload: { ...baseEvent.payload, resultBand: 'Bearer synthetic-token-value' } }),
    (error) => error.code === 'SENSITIVE_DATA_FORBIDDEN',
  );
});

test('sanitizer masks registered PII fields and scan reports no sensitive data afterwards', () => {
  const event = createTelemetryEnvelope({
    eventName: 'auth.login.succeeded.v1',
    environment: 'test',
    source: 'web',
    requestId: 'req_test_0002',
    traceId: 'trace_test_0002',
    correlationId: 'corr_test_0002',
    actorId: 'user_test_0001',
    tenantId: 'tenant_test_0001',
    payload: {
      schema: 'auth.login.succeeded',
      method: 'passwordless',
      deviceClass: 'desktop',
      userAgent: 'SyntheticTestAgent/1.0',
    },
  });

  const sanitized = sanitizeTelemetryEvent(event);
  assert.match(sanitized.payload.userAgent, /^sha256:/);
  assert.deepEqual(findSensitiveData(sanitized), []);
});
