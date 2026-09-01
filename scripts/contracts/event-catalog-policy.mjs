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

const fragmentInventory = (path, eventNames) => ({ path, eventNames: eventNames.split(' ') });

// This is deliberately a source-side inventory, rather than a rule inferred
// from catalog metadata. It freezes the accepted fragment paths
// and the ordered event contribution of each path, so a coordinated catalog
// edit cannot hide a rename, nested file, or cross-fragment move. Later M1
// tasks add isolated source fragments for their approved canonical facts;
// M1-016 contributes only the eight frozen notification, sync and support
// v2 facts below.
export const EXPECTED_EVENT_FRAGMENT_INVENTORY = Object.freeze([
  fragmentInventory('packages/contracts/events/v1/fragments/b1-assessment-privacy.events.json', 'assessment.item.submitted.v1 auth.device.kicked.v1 privacy.export.requested.v1 privacy.export.completed.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b10-learning-assessment.events.json', 'assessment.attempt.submitted.v1 assessment.attempt.assessed.v1 assessment.placement.completed.v1 learning.mastery.projected.v1 learning.review.scheduled.v1 workflow.assessment_learning.saga_started.v1 workflow.assessment_learning.saga_compensated.v1 workflow.event.replayed.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b10-learning-loop.events.json', 'assessment.item.assessed.v2 learning.mastery.projected.v2 learning.review.scheduled.v2'),
  fragmentInventory('packages/contracts/events/v1/fragments/b11-media-notification-offline.events.json', 'media.started.v1 media.segment_completed.v1 media.downloaded.v1 media.revoked.v1 notification.delivered.v1 sync.enqueued.v1 sync.conflict_detected.v1 sync.recovered.v1 recording.saved.v1 speaking.permission_requested.v1 shadowing.completed.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b12-gamification-social-notification.events.json', 'gamification.session_started.v1 gamification.xp.ledger_posted.v1 gamification.reward.granted.v1 gamification.avatar.equipped.v1 study_room.joined.v1 study_room.focus_started.v1 study_room.left.v1 leaderboard.refreshed.v1 social.report.created.v1 notification.requested.v1 notification.retry_scheduled.v1 notification.recovery.completed.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b13-commerce-admin-analytics.events.json', 'commerce.order.created.v1 commerce.payment.callback_received.v1 commerce.entitlement.activated.v1 commerce.refund.completed.v1 commerce.order.reconciled.v1 support.ticket.created.v1 analytics.metric.projected.v1 analytics.recompute.requested.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b2-assessment-mastery.events.json', 'assessment.stream_built.v1 assessment.answer_submitted.v1 mastery.verification_state_changed.v1 exam.session_state_changed.v1 exam.anti_cheat_recorded.v1 report.generated.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b2-vocabulary-srs.events.json', 'vocabulary.review.accepted.v1 vocabulary.review.filtered.v1 vocabulary.expression.created.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b26-reliability.events.json', 'workflow.outbox.published.v1 workflow.event.delivery_failed.v1 workflow.event.dead_lettered.v1 workflow.event.replay_requested.v1 workflow.event.ordering_deferred.v1 workflow.saga.compensation_requested.v1 workflow.saga.manual_recovery_requested.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b3-multimodal.events.json', 'grammar.practice.completed.v1 writing.evaluation.completed.v1 listening.dictation.submitted.v1 reading.progress.updated.v1 speaking.self_rating.submitted.v1 offline.sync.applied.v1 grammar.mastery.updated.v1 listening.progress.saved.v1 speaking.shadowing.progressed.v1 media.offline.package.synced.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b4-gamification-social.events.json', 'gamification.profile.updated.v1 gamification.xp.ledger_appended.v1 gamification.currency.ledger_appended.v1 gamification.streak.day_validated.v1 gamification.streak.rescue_completed.v1 gamification.quest.progressed.v1 gamification.quest.claimed.v1 gamification.achievement.unlocked.v1 gamification.chest.granted.v1 gamification.chest.opened.v1 gamification.avatar.loadout_equipped.v1 gamification.season.points_updated.v1 games.session.created.v1 games.session.event_accepted.v1 games.session.completed.v1 social.room.joined.v1 social.focus.started.v1 social.focus.completed.v1 social.interaction.sent.v1 social.room.left.v1 social.focus.updated.v1 social.moderation.reported.v1 social.moderation.blocked.v1 social.moderation.muted.v1 notifications.message_read.v1 notifications.preferences_updated.v1 offline.package.download_state_updated.v1 offline.sync.conflict_recorded.v1 offline.package.authorized.v1 offline.b4.sync_applied.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b5-commerce-admin.events.json', 'commerce.order.created.v1 commerce.payment.requested.v1 commerce.payment.callback_received.v1 commerce.payment.verified.v1 commerce.refund.completed.v1 commerce.household.changed.v1 cms.content.version_saved.v1 cms.import.completed.v1 safety.precheck.blocked.v1 risk.decision.created.v1 finance.reconciliation.discrepancy.v1 ops.flag.updated.v1 support.ticket.created.v1 support.ticket.resolved.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b6-platform-quality.events.json', 'platform.build.registered.v1 platform.compatibility.checked.v1 platform.performance.degraded.v1 quality.e2e.completed.v1 quality.security.scan_completed.v1 quality.reliability.completed.v1 observability.alert.raised.v1 data.backup.drill_completed.v1 release.gate.evaluated.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b8-auth-iam.events.json', 'auth.account.registered.v1 auth.login.succeeded.v1 auth.principal.mapped.v1 auth.session.rotated.v1 auth.session.replay_detected.v1 auth.device.revoked.v1 iam.session.revoked.v1 auth.consent.updated.v1 auth.adult_gate.rejected.v1 iam.policy.version_changed.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/b9-learner-content.events.json', 'learner.profile.updated.v1 learner.target.updated.v1 learner.first_day.projected.v1 content.version.submitted.v1 content.version.reviewed.v1 content.version.published.v1 content.version.unpublished.v1 content.version.rolled_back.v1 content.public_projection.invalidated.v1'),
  fragmentInventory('packages/contracts/events/v1/fragments/m1-014-gamification-social-v2.events.json', 'learning.task.completed.v2 gamification.xp.ledger_posted.v2 gamification.reward.granted.v2 study_room.seat_joined.v2 study_room.focus_started.v2 study_room.seat_left.v2 leaderboard.snapshot_published.v2 social.report.created.v2'),
  fragmentInventory('packages/contracts/events/v1/fragments/m1-015-commerce-v2.events.json', 'commerce.order.created.v2 commerce.payment.requested.v2 commerce.payment.callback_received.v2 commerce.payment.verified.v2 commerce.entitlement.activated.v2 commerce.entitlement.revoked.v2 commerce.refund.settled.v2 commerce.reconciliation.discrepancy_recorded.v2 commerce.reconciliation.recovery_receipted.v2'),
  fragmentInventory('packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json', 'notification.requested.v2 notification.retry_scheduled.v2 notification.recovery.completed.v2 sync.command_receipted.v2 sync.conflict_detected.v2 sync.recovered.v2 support.ticket.created.v2 support.ticket.resolved.v2'),
  fragmentInventory('packages/contracts/events/v1/fragments/m1-017-privacy-deletion-v2.events.json', 'privacy.export.requested.v2 privacy.export.completed.v2 account.deletion.requested.v2 account.deletion.cancelled.v2 account.deletion.completed.v2'),
]);

export const EXPECTED_FORBIDDEN_PAYLOAD_FIELD_PATTERNS = [
  '^(access|refresh)?token$',
  '^authorization$',
  '^password$',
  '^(apiKey|secret|privateKey|clientSecret)$',
  '^(phone|mobile|email|realName|identityToken|thirdPartySubject)$',
  '^(rawAnswer|answerText|answerContent|userInput|prompt)$',
  '^(audio|video|rawRecording|recordingBytes|screenPixels|imageBytes)$',
  '^(paymentCallbackRaw|jws|signedPayload|webhookBody)$',
  '^(activationCode|activationCodeHash|codeHash|signature|nonce|providerCredential|merchantIdentifier|customerIdentifier)$',
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
    'token', 'authorization', 'password', 'secret', 'signature', 'nonce', 'email', 'phone', 'mobile', 'cookie',
  ]);
  if (segments.some((segment) => directSensitiveSegments.has(segment))) return true;
  if (['apikey', 'privatekey', 'clientsecret', 'realname', 'identitytoken', 'thirdpartysubject',
    'rawanswer', 'answertext', 'answercontent', 'answerkey', 'userinput',
    'rawrecording', 'recordingbytes', 'screenpixels', 'imagebytes',
    'paymentcallbackraw', 'signedpayload', 'webhookbody', 'activationcode', 'activationcodehash', 'codehash',
    'providercredential', 'merchantidentifier', 'customeridentifier', 'devicefingerprint', 'ipaddress']
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
  '$id', 'additionalProperties', 'allOf', 'const', 'contains', 'description', 'enum', 'format', 'items',
  'exclusiveMinimum', 'maxItems', 'maxLength', 'maximum', 'minItems', 'minLength', 'minimum',
  'not', 'nullable', 'oneOf', 'pattern', 'prefixItems', 'properties', 'required', 'title', 'type', 'uniqueItems',
  'x-p1r-cross-field-invariants',
]);
const allowedPayloadSchemaTypes = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);
const forbiddenInfrastructureSubject = /\b(?:broker|kafka)\b/i;
// The B26 reliability fragment owns only this frozen seed subset.  M1-008
// adds content lifecycle facts to the canonical catalog without making them
// B26 payload definitions, so this mapping must validate the seed subset
// rather than incorrectly require every current canonical event to be B26.
export const EXPECTED_B26_CANONICAL_PAYLOAD_REFS = {
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

function validateEventCompatibility(compatibility, label, errors) {
  if (!isRecord(compatibility)) {
    errors.push(`${label} must be an object`);
    return;
  }

  const actualKeys = Object.keys(compatibility).sort();
  const minimalKeys = ['strategy'];
  const documentedKeys = ['breakingChange', 'consumerRule', 'strategy'];
  const hasAllowedShape = stableEventPolicyValue(actualKeys) === stableEventPolicyValue(minimalKeys)
    || stableEventPolicyValue(actualKeys) === stableEventPolicyValue(documentedKeys);
  if (!hasAllowedShape) {
    errors.push(`${label} keys must be exactly strategy or breakingChange, consumerRule, strategy`);
  }

  if (compatibility.strategy !== 'additive') {
    errors.push(`${label}.strategy must be additive`);
  }
  for (const key of ['breakingChange', 'consumerRule']) {
    if (compatibility[key] !== undefined && (typeof compatibility[key] !== 'string' || compatibility[key].trim() === '')) {
      errors.push(`${label}.${key} must be a non-empty string when present`);
    }
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

export function isRuntimeLikeEventPayloadField(propertyName) {
  const segments = payloadFieldSegments(propertyName);
  const runtimeSubjects = new Set(['broker', 'channel', 'connection', 'delivery', 'execution']);
  const runtimeProofs = new Set([
    'alive', 'available', 'condition', 'confirmed', 'reachable', 'ready',
    'state', 'status', 'succeeded', 'successful', 'up',
  ]);
  return segments.some((segment) => runtimeSubjects.has(segment))
    && segments.some((segment) => runtimeProofs.has(segment));
}

const eventPayloadReferencePattern = /^#\/payloadSchemas\/([A-Za-z][A-Za-z0-9_]*)$/;

export function eventPayloadSchemaName(payloadSchema) {
  if (!isRecord(payloadSchema) || Object.keys(payloadSchema).length !== 1 || !Object.hasOwn(payloadSchema, '$ref')) return undefined;
  const match = eventPayloadReferencePattern.exec(payloadSchema.$ref);
  return match?.[1];
}

export function validateExactEventPayloadReference(payloadSchema, payloadSchemas, label) {
  const errors = [];
  if (!isRecord(payloadSchema) || Object.keys(payloadSchema).length !== 1 || !Object.hasOwn(payloadSchema, '$ref')) {
    errors.push(`${label} must be exactly { $ref: '#/payloadSchemas/<Name>' }`);
    return errors;
  }
  const payloadName = eventPayloadSchemaName(payloadSchema);
  if (!payloadName) {
    errors.push(`${label} must reference one local #/payloadSchemas/<Name> definition`);
    return errors;
  }
  if (!isRecord(payloadSchemas) || !Object.hasOwn(payloadSchemas, payloadName)) {
    errors.push(`${label} references missing payload schema ${payloadName}`);
  }
  return errors;
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

function validatePayloadSchemaNode(schema, location, errors, inheritedProperties = undefined, context = {}) {
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
  if (schema.uniqueItems !== undefined && typeof schema.uniqueItems !== 'boolean') errors.push(`${location}.uniqueItems must be boolean`);
  if (schema.description !== undefined && (typeof schema.description !== 'string' || schema.description.trim() === '')) {
    errors.push(`${location}.description must be a non-empty string`);
  }
  if (schema.title !== undefined) {
    if (context.allowOneOfTitle !== true) errors.push(`${location}.title is only allowed on oneOf branches`);
    if (typeof schema.title !== 'string' || schema.title.trim() === '') errors.push(`${location}.title must be a non-empty string`);
  }
  if (schema['x-p1r-cross-field-invariants'] !== undefined) {
    const invariants = schema['x-p1r-cross-field-invariants'];
    if (!Array.isArray(invariants) || invariants.length === 0 || invariants.some((invariant) => typeof invariant !== 'string' || invariant.trim() === '')) {
      errors.push(`${location}.x-p1r-cross-field-invariants must be a non-empty string array`);
    }
  }
  for (const key of ['format', 'pattern']) {
    if (schema[key] !== undefined && typeof schema[key] !== 'string') errors.push(`${location}.${key} must be a string`);
  }
  for (const key of ['minimum', 'maximum', 'exclusiveMinimum']) {
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
  const localProperties = isRecord(schema.properties) ? schema.properties : undefined;
  const availableProperties = isRecord(inheritedProperties) || localProperties
    ? { ...(isRecord(inheritedProperties) ? inheritedProperties : {}), ...(localProperties ?? {}) }
    : undefined;
  if (schema.properties !== undefined) {
    if (!isRecord(schema.properties)) {
      errors.push(`${location}.properties must be an object`);
    } else {
      for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
        const normalized = normalizedIdentifier(propertyName);
        if (isForbiddenEventPayloadField(propertyName)) {
          errors.push(`${location}.properties.${propertyName} is a forbidden sensitive payload field`);
        }
        if (forbiddenInfrastructureSubject.test(normalized) || isRuntimeClaimKey(propertyName) || isRuntimeLikeEventPayloadField(propertyName)) {
          errors.push(`${location}.properties.${propertyName} is a forbidden runtime-like payload field`);
        }
        validatePayloadSchemaNode(propertySchema, `${location}.properties.${propertyName}`, errors);
      }
    }
  }
  if (isRecord(availableProperties)) {
    for (const requiredField of schema.required ?? []) {
      if (!Object.hasOwn(availableProperties, requiredField)) errors.push(`${location}.required references unknown property ${requiredField}`);
    }
  }
  if (schema.items !== undefined) {
    if (isRecord(schema.items)) validatePayloadSchemaNode(schema.items, `${location}.items`, errors);
    else if (typeof schema.items !== 'boolean') errors.push(`${location}.items must be a JSON Schema object or boolean`);
  }
  if (schema.prefixItems !== undefined) {
    if (!Array.isArray(schema.prefixItems) || schema.prefixItems.length === 0) {
      errors.push(`${location}.prefixItems must contain at least one JSON Schema branch`);
    } else {
      schema.prefixItems.forEach((branch, index) => validatePayloadSchemaNode(branch, `${location}.prefixItems[${index}]`, errors));
    }
  }
  if (schema.allOf !== undefined) {
    if (!Array.isArray(schema.allOf) || schema.allOf.length === 0) {
      errors.push(`${location}.allOf must contain at least one JSON Schema branch`);
    } else {
      schema.allOf.forEach((branch, index) => validatePayloadSchemaNode(branch, `${location}.allOf[${index}]`, errors, availableProperties));
    }
  }
  if (schema.oneOf !== undefined) {
    if (!Array.isArray(schema.oneOf) || schema.oneOf.length < 2) {
      errors.push(`${location}.oneOf must contain at least two JSON Schema branches`);
    } else {
      schema.oneOf.forEach((branch, index) => validatePayloadSchemaNode(
        branch,
        `${location}.oneOf[${index}]`,
        errors,
        availableProperties,
        { allowOneOfTitle: true },
      ));
    }
  }
  if (schema.contains !== undefined) {
    if (!isRecord(schema.contains)) {
      errors.push(`${location}.contains must be a JSON Schema object`);
    } else {
      validatePayloadSchemaNode(schema.contains, `${location}.contains`, errors);
    }
  }
  if (schema.not !== undefined) validatePayloadSchemaNode(schema.not, `${location}.not`, errors, availableProperties);
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
  const expectedNames = Object.keys(EXPECTED_B26_CANONICAL_PAYLOAD_REFS).sort();
  const actualNames = canonicalEvents
    .filter((event) => Object.hasOwn(EXPECTED_B26_CANONICAL_PAYLOAD_REFS, event?.eventName))
    .map((event) => event?.eventName)
    .sort();
  exact(errors, actualNames, expectedNames, `${label} names`);
  for (const [eventName, expectedRef] of Object.entries(EXPECTED_B26_CANONICAL_PAYLOAD_REFS)) {
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
  exact(errors, catalog['x-p1r-event-governance']?.fragmentInventory, EXPECTED_EVENT_FRAGMENT_INVENTORY, 'event fragmentInventory');
  errors.push(...validateEventPayloadSchemas(catalog.payloadSchemas));
  const referencedPayloadSchemas = new Set();
  if (Array.isArray(catalog.events)) {
    for (const [index, event] of catalog.events.entries()) {
      const label = `${event?.eventName ?? 'event'} payloadSchema`;
      const referenceErrors = validateExactEventPayloadReference(event?.payloadSchema, catalog.payloadSchemas, label);
      errors.push(...referenceErrors);
      if (referenceErrors.length === 0) referencedPayloadSchemas.add(eventPayloadSchemaName(event.payloadSchema));
      validateEventCompatibility(
        event?.compatibility,
        `${event?.eventName ?? `events[${index}]`} compatibility`,
        errors,
      );
    }
  }
  if (isRecord(catalog.payloadSchemas)) {
    for (const schemaName of Object.keys(catalog.payloadSchemas)) {
      if (!referencedPayloadSchemas.has(schemaName)) {
        errors.push(`event payload schema ${schemaName} must be referenced by at least one catalog event`);
      }
    }
  }
  errors.push(...validateCanonicalEventPayloadMappings(catalog.events, 'canonical M1-006 events'));
  scanUnknownRuntimeClaimKeys(catalog, 'event catalog', errors);
  scanRuntimeSuccessClaims(catalog, 'event catalog', errors);
  return errors;
}
