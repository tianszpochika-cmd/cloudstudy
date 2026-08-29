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

const runtimeSubject = /(?:\bruntime\b|\bkafka\b|\bbroker\b|\btopic\b|\boutbox\b|\bdelivery\b|\bconsumer\b|\bsaga\b|\breplay\b)/i;
const runtimeSuccess = /(?:\bcaptured\b|\bverified\b|\baccepted\b|\bpassed\b|\bready\b|\bconnected\b|\brunning\b|\bhealthy\b|\bsuccessful\b|\bcompleted?\b|\bavailable\b|\bcertified\b|\bdeployed\b|\boperational\b)/i;
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

export function validateFrozenEventCatalogPolicy(catalog) {
  const errors = [];
  if (!isRecord(catalog)) return ['event catalog must be an object'];
  exact(errors, Object.keys(catalog).sort(), [...EXPECTED_EVENT_CATALOG_KEYS].sort(), 'event catalog keys');
  exact(errors, catalog.description, EXPECTED_EVENT_CATALOG_DESCRIPTION, 'event catalog description');
  exact(errors, catalog['x-v2-event-platform'], EXPECTED_EVENT_PLATFORM, 'x-v2-event-platform');
  exact(errors, catalog.envelope, EXPECTED_EVENT_ENVELOPE, 'event envelope');
  exact(errors, catalog.compatibilityPolicy, EXPECTED_EVENT_COMPATIBILITY_POLICY, 'event compatibilityPolicy');
  exact(errors, catalog.forbiddenPayloadFieldPatterns, EXPECTED_FORBIDDEN_PAYLOAD_FIELD_PATTERNS, 'event forbiddenPayloadFieldPatterns');
  scanUnknownRuntimeClaimKeys(catalog, 'event catalog', errors);
  scanRuntimeSuccessClaims(catalog, 'event catalog', errors);
  return errors;
}
