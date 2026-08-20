import { randomUUID } from 'node:crypto';
import { assertNoSensitiveData } from './security.mjs';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

function requireId(value, fieldName) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    const error = new Error(`${fieldName} must be a non-empty correlation id`);
    error.name = 'ApiEnvelopeValidationError';
    error.code = 'INVALID_CORRELATION_ID';
    error.field = fieldName;
    throw error;
  }
  return value;
}

function assertPlainObject(value, fieldName) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error(`${fieldName} must be an object`);
    error.name = 'ApiEnvelopeValidationError';
    error.code = 'INVALID_ENVELOPE';
    error.field = fieldName;
    throw error;
  }
}

export function createApiSuccessEnvelope({ requestId = randomUUID(), traceId, data, meta = {}, serverTime = new Date().toISOString() } = {}) {
  requireId(requestId, 'requestId');
  if (traceId !== undefined) {
    requireId(traceId, 'traceId');
  }
  assertPlainObject(meta, 'meta');
  const envelope = { requestId, data, meta, serverTime };
  if (traceId !== undefined) {
    envelope.traceId = traceId;
  }
  assertNoSensitiveData(envelope, 'API_ENVELOPE_SENSITIVE_DATA');
  return envelope;
}

export function createApiErrorEnvelope({ requestId = randomUUID(), traceId, code, message, details } = {}) {
  requireId(requestId, 'requestId');
  if (traceId !== undefined) {
    requireId(traceId, 'traceId');
  }
  if (typeof code !== 'string' || !ERROR_CODE_PATTERN.test(code)) {
    const error = new Error('error.code must be a stable upper snake-case code');
    error.name = 'ApiEnvelopeValidationError';
    error.code = 'INVALID_ERROR_CODE';
    throw error;
  }
  if (typeof message !== 'string' || message.length === 0 || message.length > 200) {
    const error = new Error('error.message must contain 1-200 characters');
    error.name = 'ApiEnvelopeValidationError';
    error.code = 'INVALID_ERROR_MESSAGE';
    throw error;
  }
  const envelope = { requestId, error: { code, message } };
  if (details !== undefined) {
    assertNoSensitiveData(details, 'API_ERROR_DETAILS_SENSITIVE_DATA');
    envelope.error.details = details;
  }
  if (traceId !== undefined) {
    envelope.traceId = traceId;
  }
  return envelope;
}

export function assertApiEnvelope(envelope) {
  assertPlainObject(envelope, 'envelope');
  requireId(envelope.requestId, 'requestId');
  if (envelope.traceId !== undefined) {
    requireId(envelope.traceId, 'traceId');
  }

  const hasData = Object.hasOwn(envelope, 'data');
  const hasError = Object.hasOwn(envelope, 'error');
  if (hasData === hasError) {
    const error = new Error('envelope must contain exactly one of data or error');
    error.name = 'ApiEnvelopeValidationError';
    error.code = 'INVALID_ENVELOPE_SHAPE';
    throw error;
  }

  if (hasData) {
    assertPlainObject(envelope.meta ?? {}, 'meta');
    if (typeof envelope.serverTime !== 'string' || Number.isNaN(Date.parse(envelope.serverTime))) {
      const error = new Error('success envelope requires an ISO serverTime');
      error.name = 'ApiEnvelopeValidationError';
      error.code = 'INVALID_SERVER_TIME';
      throw error;
    }
  } else {
    assertPlainObject(envelope.error, 'error');
    if (typeof envelope.error.code !== 'string' || !ERROR_CODE_PATTERN.test(envelope.error.code)) {
      const error = new Error('error.code must be stable upper snake-case');
      error.name = 'ApiEnvelopeValidationError';
      error.code = 'INVALID_ERROR_CODE';
      throw error;
    }
    if (typeof envelope.error.message !== 'string' || envelope.error.message.length === 0 || envelope.error.message.length > 200) {
      const error = new Error('error.message must contain 1-200 characters');
      error.name = 'ApiEnvelopeValidationError';
      error.code = 'INVALID_ERROR_MESSAGE';
      throw error;
    }
    if (Object.hasOwn(envelope.error, 'details')) {
      assertNoSensitiveData(envelope.error.details, 'API_ERROR_DETAILS_SENSITIVE_DATA');
    }
  }

  assertNoSensitiveData(envelope, 'API_ENVELOPE_SENSITIVE_DATA');
  return envelope;
}

export { ID_PATTERN, ERROR_CODE_PATTERN };
