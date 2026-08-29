import { createHash } from 'node:crypto';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const EXPECTED_EVENT_CATALOG_KEYS = [
  'catalogVersion', 'schema', 'description', 'x-v2-event-platform',
  'x-p1r-event-governance', 'envelope', 'compatibilityPolicy',
  'forbiddenPayloadFieldPatterns', 'payloadSchemas', 'events', 'asyncapi',
];

export const EXPECTED_EVENT_CATALOG_DESCRIPTION = '语学星 v2 跨服务集成事实事件目录。事件契约以本目录为唯一事实源；生产者在自身事务中写入 Outbox，由 Kafka 兼容总线按至少一次语义投递。RabbitMQ 仅保留给 core-api 的 v1 历史兼容；Redis 与 Redis Streams 不是 v2 事件事实源。';

export const EXPECTED_EVENT_PLATFORM = {
  transport: 'kafka-compatible-only',
  publication: 'transactional-outbox',
  contract: 'asyncapi',
  scope: 'cross-service-integration-facts-only',
  delivery: 'at-least-once',
  partitionKey: 'aggregate-id',
  consumerRequirements: [
    'idempotent-deduplication',
    'retry',
    'dlq',
    'replay',
  ],
  redis: 'not-an-event-source',
  coreApiV1Compatibility: 'RabbitMQ-only core-api v1 historical migration compatibility',
};

export const EXPECTED_EVENT_ENVELOPE = {
  schema: 'platform.event.v1',
  required: [
    'eventId',
    'eventName',
    'schema',
    'version',
    'occurredAt',
    'aggregateType',
    'aggregateId',
    'actorId',
    'traceId',
    'requestId',
    'payload',
  ],
  properties: {
    eventId: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' },
    eventName: { type: 'string', pattern: '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+\\.v[0-9]+$' },
    schema: { type: 'string', pattern: '^[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+$' },
    version: { type: 'integer', minimum: 1 },
    occurredAt: { type: 'string', format: 'date-time' },
    aggregateType: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,63}$' },
    aggregateId: { type: 'string', minLength: 1, maxLength: 128 },
    actorId: { type: 'string', minLength: 1, maxLength: 64 },
    traceId: { type: 'string', pattern: '^[a-f0-9]{32}$' },
    requestId: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9._-]{7,127}$' },
    schemaVersion: { type: 'string', pattern: '^[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+$' },
    dedupeKey: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$' },
    clientEventId: { type: 'string', minLength: 8, maxLength: 96 },
    contentVersionId: { type: 'integer', format: 'int64', minimum: 1 },
    payload: { type: 'object' },
  },
};

export const EXPECTED_EVENT_COMPATIBILITY_POLICY = {
  versioning: 'event-name-suffix',
  rule: '仅允许向后兼容地新增可选 payload 字段；删除、改类型、改变语义或改变 required 字段必须发布同一动作的新 vN 事件名。',
  consumer: '消费者必须忽略未知字段、按 eventId 去重、按 schema/version 选择解析器，未知版本只记录兼容性指标，不产生副作用。',
  replay: '事件不可变；重放不得重复发放奖励、权益或通知。',
};

export const EXPECTED_FORBIDDEN_PAYLOAD_FIELD_PATTERNS = [
  '^(access|refresh)?token$',
  '^authorization$',
  '^password$',
  '^(apiKey|secret|privateKey|clientSecret)$',
  '^(phone|mobile|email|realName|identityToken|thirdPartySubject)$',
  '^(rawAnswer|answerText|answerContent|userInput|prompt)$',
  '^(audio|video|rawRecording|recordingBytes|screenPixels|imageBytes)$',
  '^(paymentCallbackRaw|jws|signedPayload|webhookBody)$',
  '^(deviceFingerprint|ipAddress|cookie)$',
];

export const FORBIDDEN_EVENT_PAYLOAD_FIELD_PATTERNS = EXPECTED_FORBIDDEN_PAYLOAD_FIELD_PATTERNS
  .map((pattern) => new RegExp(pattern, 'i'));

function payloadFieldSegments(value) {
  return String(value)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isForbiddenEventPayloadField(propertyName) {
  if (FORBIDDEN_EVENT_PAYLOAD_FIELD_PATTERNS.some((pattern) => pattern.test(propertyName))) return true;
  const segments = payloadFieldSegments(propertyName);
  const joined = segments.join('');
  const directSensitiveSegments = new Set([
    'token', 'authorization', 'password', 'secret', 'email', 'phone', 'mobile', 'cookie',
  ]);
  if (segments.some((segment) => directSensitiveSegments.has(segment))) return true;
  if (['apikey', 'privatekey', 'clientsecret', 'realname', 'identitytoken', 'thirdpartysubject',
    'rawanswer', 'answertext', 'answercontent', 'answerkey', 'userinput',
    'rawrecording', 'recordingbytes', 'screenpixels', 'imagebytes',
    'paymentcallbackraw', 'signedpayload', 'webhookbody', 'devicefingerprint', 'ipaddress']
    .some((sensitiveName) => joined.includes(sensitiveName))) return true;

  const safeReferenceSegments = new Set(['id', 'ref', 'version', 'digest', 'hash', 'template']);
  if (segments.includes('prompt') && !segments.some((segment) => safeReferenceSegments.has(segment))) return true;
  if ((segments.includes('audio') || segments.includes('video'))
    && !segments.includes('has')
    && !segments.some((segment) => safeReferenceSegments.has(segment))) return true;
  return false;
}

const runtimeSubject = /(?:\bruntime\b|\bkafka\b|\bbroker\b|\btopic\b|\boutbox\b|\bdelivery\b|\bconsumer\b|\bsaga\b|\breplay\b)/i;
const runtimeSuccess = /(?:\bcaptured\b|\bverified\b|\baccepted\b|\bpassed\b|\bready\b|\bconnected\b|\bconfirmed\b|\brunning\b|\bhealthy\b|\bsuccessful\b|\bsucceeded\b|\bcompleted?\b|\bavailable\b|\bonline\b|\breachable\b|\bcertified\b|\bdeployed\b|\boperational\b)/i;
const allowedStaticRuntimeValues = new Set(['NOT_RUNTIME_VERIFIED']);
const forbiddenRuntimeClaimKeySegments = new Set([
  'runtime', 'attestation', 'certified', 'deployed', 'operational',
  'promotion', 'promoted',
]);
const allowedRuntimeClaimKeys = [
  /^event catalog\.x-p1r-event-governance\.runtimeStatus$/,
  /^event catalog\.events\[\d+\]\.x-p1r-governance\.runtimeStatus$/,
  /^event catalog\.asyncapi\.x-runtime-status$/,
];
const allowedPayloadSchemaKeywords = new Set([
  '$id', 'additionalProperties', 'const', 'enum', 'format', 'items',
  'maxItems', 'maxLength', 'maximum', 'minItems', 'minLength', 'minimum',
  'nullable', 'pattern', 'properties', 'required', 'type',
]);
const allowedPayloadSchemaTypes = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);
const forbiddenInfrastructureSubject = /\b(?:broker|kafka)\b/i;
const expectedCanonicalPayloadRefs = {
  'workflow.outbox.published.v1': '#/payloadSchemas/B26WorkflowOutboxPublished',
  'workflow.event.delivery_failed.v1': '#/payloadSchemas/B26WorkflowDeliveryFailed',
  'workflow.event.dead_lettered.v1': '#/payloadSchemas/B26WorkflowDeadLettered',
  'workflow.event.replay_requested.v1': '#/payloadSchemas/B26WorkflowReplayRequested',
  'workflow.event.ordering_deferred.v1': '#/payloadSchemas/B26WorkflowOrderingDeferred',
  'workflow.saga.compensation_requested.v1': '#/payloadSchemas/B26WorkflowCompensationRequested',
  'workflow.saga.manual_recovery_requested.v1': '#/payloadSchemas/B26WorkflowManualRecoveryRequested',
};
const expectedB26PayloadDigests = {
  B26WorkflowOutboxPublished: '085617d02cf4a19a02038c7c8f6eefa63ec1cce8672d9844a31ccb5f002eceea',
  B26WorkflowDeliveryFailed: '6c97fded88a35699d197de40110bb77656b3e812e7ef688ab964bb8cc1395d48',
  B26WorkflowDeadLettered: 'd1a2c8e60d292e71da229b745194698ee16886309323fe0803abc7c0bfbac991',
  B26WorkflowReplayRequested: 'e29a89448eeb804946d014732780e985469c462131789b0bb004ec09eda9fac7',
  B26WorkflowOrderingDeferred: '2ba314d512a17f37f5b02e6cb1216660de57cec8a27ef2dedbe119478fc18e73',
  B26WorkflowCompensationRequested: '834def3f6ae0354f4b695f4d5507a64add5362d1988436c25cf8e6fc15f18c93',
  B26WorkflowManualRecoveryRequested: 'd872308b461a7e6ce3e9774a2d3780fa28e4e67cea8037aa9c1a2be883b89905',
};

export function stableEventPolicyValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableEventPolicyValue).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableEventPolicyValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function exact(errors, actual, expected, label) {
  if (stableEventPolicyValue(actual) !== stableEventPolicyValue(expected)) {
    errors.push(`${label} must exactly match the frozen M1-006 policy`);
  }
}

function scanRuntimeSuccessClaims(value, location, errors) {
  if (typeof value === 'string') {
    const normalized = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_./:-]+/g, ' ');
    if (!allowedStaticRuntimeValues.has(value) && runtimeSubject.test(normalized) && runtimeSuccess.test(normalized)) {
      errors.push(`${location} contains a runtime success claim that static contract data cannot make`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanRuntimeSuccessClaims(item, `${location}[${index}]`, errors));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => scanRuntimeSuccessClaims(item, `${location}.${key}`, errors));
  }
}

function isRuntimeClaimKey(key) {
  const segments = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  return segments.some((segment) => forbiddenRuntimeClaimKeySegments.has(segment));
}

function scanUnknownRuntimeClaimKeys(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnknownRuntimeClaimKeys(item, `${location}[${index}]`, errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    const itemLocation = `${location}.${key}`;
    if (isRuntimeClaimKey(key) && !allowedRuntimeClaimKeys.some((pattern) => pattern.test(itemLocation))) {
      errors.push(`${itemLocation} is an unknown runtime proof or attestation field`);
    }
    scanUnknownRuntimeClaimKeys(item, itemLocation, errors);
  }
}

function normalizedIdentifier(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[^a-z0-9]+/gi, ' ');
}

function validatePayloadSchemaNode(schema, location, errors) {
  if (!isRecord(schema)) {
    errors.push(`${location} must be a JSON Schema object`);
    return;
  }
  for (const key of Object.keys(schema)) {
    if (!allowedPayloadSchemaKeywords.has(key)) errors.push(`${location}.${key} is not an allowed M1-006 payload schema keyword`);
  }
  if (schema.$id !== undefined && (typeof schema.$id !== 'string' || !schema.$id.startsWith('platform.events.'))) {
    errors.push(`${location}.$id must be a platform.events schema identity`);
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const validType = types.length > 0
      && types.every((value) => typeof value === 'string' && allowedPayloadSchemaTypes.has(value))
      && new Set(types).size === types.length;
    if (!validType) errors.push(`${location}.type must contain only duplicate-free JSON Schema primitive types`);
  }
  if (schema.nullable !== undefined && typeof schema.nullable !== 'boolean') errors.push(`${location}.nullable must be boolean`);
  for (const key of ['format', 'pattern']) {
    if (schema[key] !== undefined && typeof schema[key] !== 'string') errors.push(`${location}.${key} must be a string`);
  }
  for (const key of ['minimum', 'maximum']) {
    if (schema[key] !== undefined && (typeof schema[key] !== 'number' || !Number.isFinite(schema[key]))) errors.push(`${location}.${key} must be a finite number`);
  }
  for (const key of ['minLength', 'maxLength', 'minItems', 'maxItems']) {
    if (schema[key] !== undefined && (!Number.isInteger(schema[key]) || schema[key] < 0)) errors.push(`${location}.${key} must be a non-negative integer`);
  }
  for (const [minimumKey, maximumKey] of [['minimum', 'maximum'], ['minLength', 'maxLength'], ['minItems', 'maxItems']]) {
    if (typeof schema[minimumKey] === 'number' && typeof schema[maximumKey] === 'number' && schema[minimumKey] > schema[maximumKey]) {
      errors.push(`${location}.${minimumKey} cannot exceed ${maximumKey}`);
    }
  }
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length === 0 || new Set(schema.enum.map(stableEventPolicyValue)).size !== schema.enum.length)) {
    errors.push(`${location}.enum must be a non-empty duplicate-free array`);
  }
  // Payload constraints describe valid event instances; runtime attestations are
  // governed separately and must never be inferred from const/enum/range shapes.
  for (const [keyword, value] of Object.entries(schema)) {
    const literals = Array.isArray(value) ? value : [value];
    for (const literal of literals) {
      if (typeof literal === 'string' && forbiddenInfrastructureSubject.test(normalizedIdentifier(literal))) {
        errors.push(`${location}.${keyword} cannot encode Kafka or broker runtime facts`);
      }
    }
  }
  if (schema.required !== undefined) {
    if (!Array.isArray(schema.required) || schema.required.some((field) => typeof field !== 'string') || new Set(schema.required).size !== schema.required.length) {
      errors.push(`${location}.required must be a duplicate-free string array`);
    }
  }
  if (schema.properties !== undefined) {
    if (!isRecord(schema.properties)) {
      errors.push(`${location}.properties must be an object`);
    } else {
      for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
        const normalized = normalizedIdentifier(propertyName);
        if (isForbiddenEventPayloadField(propertyName)) {
          errors.push(`${location}.properties.${propertyName} is a forbidden sensitive payload field`);
        }
        if (forbiddenInfrastructureSubject.test(normalized) || isRuntimeClaimKey(propertyName)) {
          errors.push(`${location}.properties.${propertyName} is a forbidden runtime proof field`);
        }
        validatePayloadSchemaNode(propertySchema, `${location}.properties.${propertyName}`, errors);
      }
      for (const requiredField of schema.required ?? []) {
        if (!Object.hasOwn(schema.properties, requiredField)) errors.push(`${location}.required references unknown property ${requiredField}`);
      }
    }
  }
  if (schema.items !== undefined) validatePayloadSchemaNode(schema.items, `${location}.items`, errors);
  if (isRecord(schema.additionalProperties)) validatePayloadSchemaNode(schema.additionalProperties, `${location}.additionalProperties`, errors);
  else if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') errors.push(`${location}.additionalProperties must be boolean or a JSON Schema object`);
}

export function validateEventPayloadSchemas(payloadSchemas, label = 'event payloadSchemas') {
  const errors = [];
  if (!isRecord(payloadSchemas)) return [`${label} must be an object`];
  for (const [schemaName, schema] of Object.entries(payloadSchemas)) {
    validatePayloadSchemaNode(schema, `${label}.${schemaName}`, errors);
    const expectedDigest = expectedB26PayloadDigests[schemaName];
    if (expectedDigest !== undefined) {
      const actualDigest = createHash('sha256').update(stableEventPolicyValue(schema)).digest('hex');
      if (actualDigest !== expectedDigest) errors.push(`${label}.${schemaName} must exactly match its frozen B26 canonical payload digest`);
    }
  }
  return errors;
}

export function validateCanonicalEventPayloadMappings(events, label = 'canonical M1-006 events') {
  const errors = [];
  if (!Array.isArray(events)) return [`${label} must be an array`];
  const canonicalEvents = events.filter((event) => event?.status === 'CANONICAL_D2');
  const actualNames = canonicalEvents.map((event) => event?.eventName).sort();
  const expectedNames = Object.keys(expectedCanonicalPayloadRefs).sort();
  exact(errors, actualNames, expectedNames, `${label} names`);
  for (const [eventName, expectedRef] of Object.entries(expectedCanonicalPayloadRefs)) {
    const matches = canonicalEvents.filter((event) => event?.eventName === eventName);
    if (matches.length === 1 && matches[0]?.payloadSchema?.$ref !== expectedRef) {
      errors.push(`${eventName} payloadSchema.$ref must match the frozen M1-006 event-to-payload mapping`);
    }
  }
  return errors;
}

export function validateFrozenEventCatalogPolicy(catalog) {
  const errors = [];
  if (!isRecord(catalog)) return ['event catalog must be an object'];
  exact(errors, Object.keys(catalog).sort(), [...EXPECTED_EVENT_CATALOG_KEYS].sort(), 'event catalog keys');
  exact(errors, catalog.description, EXPECTED_EVENT_CATALOG_DESCRIPTION, 'event catalog description');
  exact(errors, catalog['x-v2-event-platform'], EXPECTED_EVENT_PLATFORM, 'x-v2-event-platform');
  exact(errors, catalog.envelope, EXPECTED_EVENT_ENVELOPE, 'event envelope');
  exact(errors, catalog.compatibilityPolicy, EXPECTED_EVENT_COMPATIBILITY_POLICY, 'event compatibilityPolicy');
  exact(errors, catalog.forbiddenPayloadFieldPatterns, EXPECTED_FORBIDDEN_PAYLOAD_FIELD_PATTERNS, 'event forbiddenPayloadFieldPatterns');
  errors.push(...validateEventPayloadSchemas(catalog.payloadSchemas));
  errors.push(...validateCanonicalEventPayloadMappings(catalog.events, 'canonical M1-006 events'));
  scanUnknownRuntimeClaimKeys(catalog, 'event catalog', errors);
  scanRuntimeSuccessClaims(catalog, 'event catalog', errors);
  return errors;
}
