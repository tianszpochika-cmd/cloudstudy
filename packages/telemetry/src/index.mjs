import { randomUUID } from 'node:crypto';
import { ACCESS_POLICY, TELEMETRY_POLICY, TELEMETRY_SCHEMA } from './policy-loader.mjs';
import {
  assertNoSensitiveData,
  authorize,
  authorizeExport,
  evaluateAccess,
  findSensitiveData,
  isSensitiveKeyName,
  maskExportFields,
} from './security.mjs';
import { assertApiEnvelope, createApiErrorEnvelope, createApiSuccessEnvelope } from './api-envelope.mjs';

const ID_PATTERN = new RegExp(TELEMETRY_POLICY.idPattern);
const EVENT_NAME_PATTERN = new RegExp(TELEMETRY_POLICY.eventNamePattern);
const EVENT_VERSION_PATTERN = new RegExp(TELEMETRY_POLICY.eventVersionPattern);
const MASKABLE_FIELDS = TELEMETRY_POLICY.maskableFields;

export class TelemetryValidationError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(message);
    this.name = 'TelemetryValidationError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, path) {
  if (!isPlainObject(value)) {
    throw new TelemetryValidationError('OBJECT_REQUIRED', `${path} must be an object`, path);
  }
}

function assertId(value, path, { nullable = false } = {}) {
  if (nullable && value === null) {
    return;
  }
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TelemetryValidationError('INVALID_ID', `${path} must be a correlation-safe id`, path);
  }
}

function assertDateTime(value, path) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new TelemetryValidationError('INVALID_DATETIME', `${path} must be an ISO date-time`, path);
  }
}

function cloneAndMask(value, path = '$') {
  if (Array.isArray(value)) {
    return value.map((child, index) => cloneAndMask(child, `${path}[${index}]`));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKeyName(key)) {
      throw new TelemetryValidationError('SENSITIVE_FIELD_FORBIDDEN', `${path}.${key} is not allowed in telemetry`, `${path}.${key}`);
    }
    const strategy = MASKABLE_FIELDS[key];
    if (strategy === 'email' && typeof child === 'string') {
      const [local, domain] = child.split('@');
      output[key] = local && domain ? `${local[0]}***@${domain}` : '***';
      continue;
    }
    if (strategy === 'phone' && typeof child === 'string') {
      output[key] = child.length <= 4 ? '****' : `${'*'.repeat(Math.max(0, child.length - 4))}${child.slice(-4)}`;
      continue;
    }
    if (strategy === 'partial' && typeof child === 'string') {
      output[key] = child.length <= 2 ? '*'.repeat(child.length) : `${child[0]}***${child.at(-1)}`;
      continue;
    }
    if (strategy === 'ip' && typeof child === 'string') {
      const octets = child.split('.');
      output[key] = octets.length === 4 ? `${octets.slice(0, 3).join('.')}.*` : '***';
      continue;
    }
    if (strategy === 'hash' && typeof child === 'string') {
      output[key] = `sha256:${Buffer.from(child).toString('base64url').slice(0, 16)}`;
      continue;
    }
    output[key] = cloneAndMask(child, `${path}.${key}`);
  }
  return output;
}

function eventSpec(eventName, eventVersion) {
  const event = TELEMETRY_POLICY.events[eventName];
  if (!event) {
    throw new TelemetryValidationError('EVENT_NOT_REGISTERED', `event ${eventName} is not registered`, '$.eventName');
  }
  const version = event.versions[eventVersion];
  if (!version) {
    throw new TelemetryValidationError('EVENT_VERSION_NOT_REGISTERED', `event version ${eventName}@${eventVersion} is not registered`, '$.eventVersion');
  }
  return version;
}

function assertPayload(event) {
  assertObject(event.payload, '$.payload');
  const spec = eventSpec(event.eventName, event.eventVersion);
  for (const field of spec.required) {
    if (!Object.hasOwn(event.payload, field)) {
      throw new TelemetryValidationError('PAYLOAD_FIELD_REQUIRED', `payload.${field} is required`, `$.payload.${field}`);
    }
  }
  for (const field of Object.keys(event.payload)) {
    if (!spec.allowed.includes(field)) {
      throw new TelemetryValidationError('PAYLOAD_FIELD_NOT_ALLOWED', `payload.${field} is not registered`, `$.payload.${field}`);
    }
  }
  const expectedSchema = event.eventName.replace(/\.v\d+$/, '');
  if (event.payload.schema !== expectedSchema) {
    throw new TelemetryValidationError('PAYLOAD_SCHEMA_MISMATCH', `payload.schema must be ${expectedSchema}`, '$.payload.schema');
  }
}

export function assertTelemetryEvent(event) {
  assertObject(event, '$');
  for (const field of TELEMETRY_POLICY.envelope.required) {
    if (!Object.hasOwn(event, field)) {
      throw new TelemetryValidationError('ENVELOPE_FIELD_REQUIRED', `${field} is required`, `$.${field}`);
    }
  }
  const allowedFields = new Set([...TELEMETRY_POLICY.envelope.required, ...TELEMETRY_POLICY.envelope.optional]);
  for (const field of Object.keys(event)) {
    if (!allowedFields.has(field)) {
      throw new TelemetryValidationError('ENVELOPE_FIELD_NOT_ALLOWED', `${field} is not allowed`, `$.${field}`);
    }
  }
  if (typeof event.eventName !== 'string' || !EVENT_NAME_PATTERN.test(event.eventName)) {
    throw new TelemetryValidationError('INVALID_EVENT_NAME', 'eventName must follow domain.action.vN', '$.eventName');
  }
  if (typeof event.eventVersion !== 'string' || !EVENT_VERSION_PATTERN.test(event.eventVersion)) {
    throw new TelemetryValidationError('INVALID_EVENT_VERSION', 'eventVersion must be semver', '$.eventVersion');
  }
  for (const field of ['eventId', 'requestId', 'traceId', 'correlationId']) {
    assertId(event[field], `$.${field}`);
  }
  for (const field of ['actorId', 'tenantId', 'sessionId', 'deviceId']) {
    if (Object.hasOwn(event, field) && event[field] !== null) {
      assertId(event[field], `$.${field}`);
    }
  }
  assertDateTime(event.occurredAt, '$.occurredAt');
  if (!TELEMETRY_POLICY.envelope.allowedEnvironments.includes(event.environment)) {
    throw new TelemetryValidationError('INVALID_ENVIRONMENT', 'environment is not allowed', '$.environment');
  }
  if (!TELEMETRY_POLICY.envelope.allowedSources.includes(event.source)) {
    throw new TelemetryValidationError('INVALID_SOURCE', 'source is not allowed', '$.source');
  }
  if (event.resource !== undefined && event.resource !== null) {
    assertObject(event.resource, '$.resource');
    const resourceFields = new Set(['resourceType', 'resourceId']);
    for (const field of Object.keys(event.resource)) {
      if (!resourceFields.has(field)) {
        throw new TelemetryValidationError('RESOURCE_FIELD_NOT_ALLOWED', `${field} is not allowed in resource`, `$.resource.${field}`);
      }
    }
    if (typeof event.resource.resourceType !== 'string' || event.resource.resourceType.length === 0) {
      throw new TelemetryValidationError('RESOURCE_TYPE_REQUIRED', 'resource.resourceType is required', '$.resource.resourceType');
    }
    if (event.resource.resourceId !== undefined && event.resource.resourceId !== null) {
      assertId(event.resource.resourceId, '$.resource.resourceId');
    }
  }
  assertPayload(event);
  assertNoSensitiveData(event);
  return event;
}

export function sanitizeTelemetryEvent(event) {
  assertObject(event, '$');
  const sanitized = cloneAndMask(event);
  return assertTelemetryEvent(sanitized);
}

export function createRequestContext({ requestId, traceId, correlationId, actorId = null, tenantId = null, sessionId = null, deviceId = null } = {}) {
  const resolvedRequestId = requestId ?? randomUUID();
  const resolvedTraceId = traceId ?? randomUUID();
  return {
    requestId: resolvedRequestId,
    traceId: resolvedTraceId,
    correlationId: correlationId ?? resolvedRequestId,
    actorId,
    tenantId,
    sessionId,
    deviceId,
  };
}

export function createTelemetryEnvelope({
  eventId,
  eventName,
  eventVersion = '1.0.0',
  occurredAt = new Date().toISOString(),
  environment = 'local',
  source = 'api',
  requestId,
  traceId,
  correlationId,
  actorId = null,
  tenantId = null,
  sessionId = null,
  deviceId = null,
  resource,
  payload,
} = {}) {
  const context = createRequestContext({ requestId, traceId, correlationId, actorId, tenantId, sessionId, deviceId });
  const event = {
    eventId: eventId ?? randomUUID(),
    eventName,
    eventVersion,
    occurredAt,
    environment,
    source,
    ...context,
    payload,
  };
  if (resource !== undefined) {
    event.resource = resource;
  }
  return sanitizeTelemetryEvent(event);
}

function majorVersion(version) {
  return Number.parseInt(version.split('.')[0], 10);
}

export function checkEventCompatibility(previousEvent, nextEvent) {
  const reasons = [];
  if (previousEvent.eventName !== nextEvent.eventName) {
    reasons.push('EVENT_NAME_CHANGED');
  }
  if (majorVersion(previousEvent.eventVersion) !== majorVersion(nextEvent.eventVersion)) {
    reasons.push('MAJOR_VERSION_CHANGED');
  }

  try {
    const previousSpec = eventSpec(previousEvent.eventName, previousEvent.eventVersion);
    const nextSpec = eventSpec(nextEvent.eventName, nextEvent.eventVersion);
    const previousAllowed = new Set(previousSpec.allowed);
    const nextAllowed = new Set(nextSpec.allowed);
    for (const field of previousAllowed) {
      if (!nextAllowed.has(field)) {
        reasons.push(`FIELD_REMOVED:${field}`);
      }
    }
    if (JSON.stringify([...previousSpec.required].sort()) !== JSON.stringify([...nextSpec.required].sort())) {
      reasons.push('REQUIRED_FIELDS_CHANGED');
    }
  } catch (error) {
    reasons.push(error.code ?? 'EVENT_SPEC_INVALID');
  }

  return { compatible: reasons.length === 0, reasons };
}

export function isTelemetryEventCompatible(previousEvent, nextEvent) {
  return checkEventCompatibility(previousEvent, nextEvent).compatible;
}

export {
  ACCESS_POLICY,
  TELEMETRY_POLICY,
  TELEMETRY_SCHEMA,
  assertNoSensitiveData,
  assertApiEnvelope,
  authorize,
  authorizeExport,
  evaluateAccess,
  findSensitiveData,
  maskExportFields,
  createApiErrorEnvelope,
  createApiSuccessEnvelope,
};
