import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ASSESSMENT_POLICY = 'config/p1r-assessment-contract.v1.json';
export const DEFAULT_B10_OPENAPI = 'packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json';
export const DEFAULT_B2_OPENAPI = 'packages/contracts/fragments/b2-assessment-mastery.openapi.json';
export const DEFAULT_CANONICAL_OPENAPI = 'packages/contracts/openapi/v1/openapi.json';
export const DEFAULT_EVENT_FRAGMENT = 'packages/contracts/events/v1/fragments/b10-learning-assessment.events.json';
export const DEFAULT_EVENT_CATALOG = 'packages/contracts/events/v1/catalog.json';
export const DEFAULT_GAP_REGISTRY = 'config/p1r-gap-registry.v1.json';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTTP_WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const REQUIRED_TRUSTED_FACTS = Object.freeze([
  'subject', 'tenant', 'adultGate', 'phase', 'contentRights', 'entitlement', 'resourceOwner', 'policyVersion',
]);
const SESSION_STATES = Object.freeze([
  'CREATED', 'IN_PROGRESS', 'INTERRUPTED', 'SUBMITTING', 'COMPLETED', 'AUTO_SUBMITTED', 'CANCELLED', 'EXPIRED',
]);
const ATTEMPT_STATES = Object.freeze(['ACCEPTED', 'ASSESSING', 'ASSESSED', 'REJECTED']);
const REPORT_STATES = Object.freeze(['GENERATING', 'READY', 'PARTIAL', 'FAILED']);
const ACTIVE_CONTENT_PIN_FIELDS = Object.freeze([
  'contentCode', 'contentVersionId', 'contentEpoch', 'snapshotId', 'snapshotHash', 'status', 'pinnedAt',
]);
const PARENT_REPLAY_FIELDS = Object.freeze(['itemRulePins', 'answerRuleSetVersion', 'completionRuleVersion']);
const ITEM_RULE_PIN_FIELDS = Object.freeze(['itemId', 'answerRuleVersion', 'ruleDigest', 'evaluationMode']);
const CHECKPOINT_FIELDS = Object.freeze([
  'protectedDraft', 'baseStateVersion', 'checkpointVersion', 'clientEventId', 'clientSeq', 'checkpointDigest',
]);
const CHECKPOINT_POLICY = Object.freeze({
  sameVersionSameDigest: 'REPLAY',
  olderVersion: 'CONFLICT_409',
  sameVersionDifferentDigest: 'CONFLICT_409',
  terminalState: 'CONFLICT_409',
});
const ANSWER_TYPES = Object.freeze(['CHOICE', 'MATCHING', 'ORDERING', 'CLOZE', 'TEXT', 'UNANSWERED']);
const ANSWER_ITEM_REQUIRED_FIELDS = Object.freeze(['itemId', 'sequence', 'responseType', 'responseDigest']);
const ANSWER_FORBIDDEN_FIELDS = Object.freeze([
  'score', 'scoreBucket', 'isCorrect', 'correct', 'answerRule', 'answerRuleVersion', 'ruleDigest', 'gradingRuleVersion',
]);
const OUTCOME_FIELDS = Object.freeze([
  'objectiveNumerator', 'objectiveDenominator', 'scoreBucket', 'errorCategory', 'reasonTrace', 'outcomeDigest',
]);
const OBJECTIVE_ONLY_OUTCOME_FIELDS = Object.freeze(['objectiveNumerator', 'objectiveDenominator', 'scoreBucket', 'errorCategory']);
const REPORT_FIELDS = Object.freeze([
  'sessionId', 'attemptId', 'submissionId', 'submissionDigest', 'attemptVersion', 'reportVersion', 'reportRuleVersion', 'assessmentVersion', 'asOf', 'assessmentFactWatermark',
]);
const REPORT_FORBIDDEN_FIELDS = Object.freeze([
  'mastery', 'masteryLevel', 'masterySignal', 'srsSchedule', 'reviewSchedule', 'nationwidePercentile', 'officialCertification',
]);
const ATTEMPT_ASSESSED_FIELDS = Object.freeze(['assessmentVersion', 'outcome', 'reportId', 'assessedAt']);
const REPORT_GENERATING_FORBIDDEN_FIELDS = Object.freeze(['outcome', 'mistakeCodes', 'partialReasonCodes', 'failureCode', 'retryable']);
const REPORT_READY_FORBIDDEN_FIELDS = Object.freeze(['partialReasonCodes', 'failureCode', 'retryable']);
const REPORT_PARTIAL_FORBIDDEN_FIELDS = Object.freeze(['failureCode', 'retryable']);
const REPORT_FAILED_FORBIDDEN_FIELDS = Object.freeze(['outcome', 'mistakeCodes', 'partialReasonCodes']);
const SUBMITTED_EVENT_FIELDS = Object.freeze([
  'attemptId', 'sessionId', 'contentVersionId', 'contentEpoch', 'snapshotId', 'snapshotHash', 'answerRuleSetVersion', 'answerRuleVersion', 'ruleDigest', 'completionRuleVersion', 'submissionId', 'submissionDigest', 'attemptVersion',
]);
const ASSESSED_EVENT_FIELDS = Object.freeze([
  ...SUBMITTED_EVENT_FIELDS,
  'reportId', 'reportVersion', 'reportRuleVersion', 'assessmentVersion', 'asOf', 'assessmentFactWatermark',
  'outcomeKind', 'objectiveNumerator', 'objectiveDenominator', 'scoreBucket', 'errorCategory', 'reasonTrace', 'outcomeDigest',
]);
const EVENT_FORBIDDEN_FIELDS = Object.freeze([
  'rawResponse', 'response', 'responses', 'answer', 'answers', 'answerKey', 'answerRule', 'rules', 'recording', 'recordingUrl', 'audio', 'transcript', 'selfRating', 'reviewStatus',
]);
const PHASE1_PROHIBITIONS = Object.freeze([
  'authoritative-cheating-conclusion', 'focus-or-switch-score-driving', 'focus-or-switch-reward-driving', 'focus-or-switch-ban-driving',
  'official-certification', 'official-testbank', 'nationwide-percentile', 'ai-scoring-authority', 'ai-mastery-authority',
]);
const SENSITIVE_AUDIT_FIELDS = Object.freeze(['rawResponse', 'answerKey', 'answerRule', 'ruleDigest', 'recording', 'recordingUrl']);
const RUNTIME_PROHIBITED_CLAIMS = Object.freeze([
  'assessment-service-http-executed', 'mysql-session-attempt-report-persisted', 'outbox-or-kafka-delivery-verified',
  'gateway-or-resource-server-pep-verified', 'saga-or-learning-projection-verified', 'browser-or-device-e2e-verified',
]);
const OUTCOME_FORBIDDEN_CLAIMS = Object.freeze([
  'subjective-self-rating-as-objective', 'mastery-authority', 'ai-authority', 'official-certification', 'testbank-authority', 'nationwide-percentile', 'authoritative-cheating-conclusion',
]);
const ASSESSMENT_MUST_NOT_OWN = Object.freeze(['mastery', 'srs', 'reviewSchedule', 'contentAnswerRuleMaster']);
const LEGACY_DEPRECATION = Object.freeze({
  deprecationAt: '2026-08-30T00:00:00Z',
  sunsetAt: 'UNSCHEDULED_UNTIL_DECLARED_REPLACEMENT_RUNTIME_GATE_ACCEPTED',
  migrationLink: '/docs/07-operations/b10-validation#legacy-adapter-retirement',
});
const EXPECTED_ADVERSARIAL_CASES = Object.freeze([
  'CONFIG_UNKNOWN_FIELD', 'CONFIG_DUPLICATE_ROUTE', 'CONFIG_RUNTIME_PROMOTION', 'COMPATIBILITY_PROMOTION_DRIFT', 'CANONICAL_ROUTE_DRIFT',
  'MISSING_PEP_TRUSTED_FACT', 'AUTHZ_DEFAULT_ALLOW', 'SESSION_STATE_ENUM_DRIFT', 'ATTEMPT_STATE_ENUM_DRIFT', 'REPORT_STATE_ENUM_DRIFT',
  'ATTEMPT_ACCEPTED_REJECTION_LEAK', 'ATTEMPT_ASSESSED_REJECTION_LEAK', 'ATTEMPT_REJECTED_OUTCOME_LEAK',
  'REPORT_GENERATING_OUTCOME_LEAK', 'REPORT_READY_FAILURE_LEAK', 'REPORT_PARTIAL_FAILURE_LEAK', 'REPORT_FAILED_OUTCOME_LEAK',
  'PIN_FIELD_REMOVAL', 'PIN_UNKNOWN_FIELD', 'CHECKPOINT_NOT_SESSION_SCOPED', 'CHECKPOINT_MISSING_BASE_STATE_VERSION',
  'CHECKPOINT_SAME_VERSION_REPLAY_WEAKENED', 'CHECKPOINT_OLD_VERSION_NOT_409', 'CHECKPOINT_SAME_VERSION_DIFFERENT_DIGEST_NOT_409',
  'CHECKPOINT_TERMINAL_NOT_409', 'ANSWER_ONEOF_REMOVAL', 'ANSWER_NOT_GUARD_REMOVAL', 'ANSWER_NOT_GUARD_WEAKENED', 'ANSWER_UNKNOWN_TYPE', 'CLIENT_SCORE_INJECTION',
  'CLIENT_RULE_INJECTION', 'SUBMISSION_DIGEST_REMOVAL', 'OUTCOME_OBJECTIVE_NUMERATOR_REMOVAL', 'OUTCOME_REASON_TRACE_REMOVAL',
  'SUBJECTIVE_OBJECTIVE_IMPERSONATION', 'REPORT_VERSION_REMOVAL', 'REPORT_MASTERY_LEAK', 'LEGACY_ATTEMPT_ROUTE_NOT_DEPRECATED', 'LEGACY_DEPRECATION_DRIFT', 'B2_LEGACY_ROUTE_NOT_DEPRECATED',
  'EVENT_RAW_RESPONSE_LEAK', 'EVENT_RAW_RULE_LEAK', 'EVENT_RECORDING_LEAK', 'EVENT_SUBJECTIVE_OUTCOME_LEAK', 'EVENT_CANONICAL_PROMOTION', 'EVENT_GAP_CLOSURE',
  'AI_AUTHORITY_CLAIM', 'ANTI_CHEAT_AUTHORITY_CLAIM', 'OFFICIAL_CERTIFICATION_CLAIM', 'RUNTIME_STATUS_PROMOTION',
]);
const CLIENT_AUTHORITY_FIELDS = Object.freeze([
  'tenant', 'tenantId', 'subject', 'subjectId', 'owner', 'ownerId', 'adultGate', 'phase', 'contentRights', 'entitlement', 'policyVersion', 'score', 'isCorrect', 'answerRule', 'ruleDigest',
]);
const REQUIRED_CANONICAL_ROUTES = Object.freeze([
  {
    id: 'assessment-session-create', path: '/api/v1/assessment/sessions', method: 'POST', operationId: 'createB10AssessmentSession',
    requestSchema: 'B10CreateAssessmentSessionRequest', responseSchema: 'B10AssessmentSession', idempotencyRequired: true,
  },
  {
    id: 'assessment-session-read', path: '/api/v1/assessment/sessions/{sessionId}', method: 'GET', operationId: 'getB10AssessmentSession',
    requestSchema: null, responseSchema: 'B10AssessmentSession', idempotencyRequired: false,
  },
  {
    id: 'assessment-session-checkpoint', path: '/api/v1/assessment/sessions/{sessionId}/checkpoint', method: 'PUT', operationId: 'putB10AssessmentSessionCheckpoint',
    requestSchema: 'B10AssessmentSessionCheckpointRequest', responseSchema: 'B10AssessmentCheckpoint', idempotencyRequired: true,
  },
  {
    id: 'assessment-attempt-submit', path: '/api/v1/assessment/sessions/{sessionId}/attempts', method: 'POST', operationId: 'submitB10AssessmentAttempt',
    requestSchema: 'B10SubmitAttemptRequest', responseSchema: 'B10Attempt', idempotencyRequired: true,
  },
  {
    id: 'assessment-report-read', path: '/api/v1/assessment/reports/{reportId}', method: 'GET', operationId: 'getB10AssessmentReport',
    requestSchema: null, responseSchema: 'B10AssessmentReport', idempotencyRequired: false,
  },
]);
const EXPECTED_COMPATIBILITY_PROMOTION = Object.freeze({
  id: 'M1-010_ASSESSMENT_CONTRACT_PROMOTION',
  sourceContractBaseline: '760621e45b9adc95a6aa40fb1678a8d3ebc87797',
  previousPromotion: 'M1-009_MEDIA_CONTRACT_PROMOTION',
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  scope: 'OPENAPI_AND_HISTORICAL_EVENT_PAYLOADS',
  eventCatalogDecision: 'HISTORICAL_PAYLOADS_ONLY_NO_CANONICAL_PROMOTION',
  canonicalFragment: DEFAULT_B10_OPENAPI,
  legacyAdapterFragment: DEFAULT_B2_OPENAPI,
  historicalEventFragment: DEFAULT_EVENT_FRAGMENT,
});
const EXPECTED_SOURCE_PATHS = Object.freeze({
  b10Fragment: DEFAULT_B10_OPENAPI,
  b2LegacyFragment: DEFAULT_B2_OPENAPI,
  openApi: DEFAULT_CANONICAL_OPENAPI,
  historicalEventFragment: DEFAULT_EVENT_FRAGMENT,
  eventCatalog: DEFAULT_EVENT_CATALOG,
  gapRegistry: DEFAULT_GAP_REGISTRY,
});
const EXPECTED_LEGACY_OPERATIONS = Object.freeze([
  ['b10-attempt-checkpoint', 'B10', '/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint', 'PUT', 'putB10AssessmentCheckpoint', 'putB10AssessmentSessionCheckpoint'],
  ['b2-daily-stream', 'B2', '/api/v1/assessment/daily-stream', 'GET', 'getB2DailyStream', 'getTodayLearningStream'],
  ['b2-session-create', 'B2', '/api/v1/assessment/sessions', 'POST', 'createB2AssessmentSession', 'createB10AssessmentSession'],
  ['b2-session-read', 'B2', '/api/v1/assessment/sessions/{sessionId}', 'GET', 'getB2AssessmentSession', 'getB10AssessmentSession'],
  ['b2-answer-submit', 'B2', '/api/v1/assessment/sessions/{sessionId}/answers', 'POST', 'submitB2AssessmentAnswer', 'submitB10AssessmentAttempt'],
  ['b2-checkpoint', 'B2', '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'PUT', 'saveB2AssessmentCheckpoint', 'putB10AssessmentSessionCheckpoint'],
  ['b2-session-complete', 'B2', '/api/v1/assessment/sessions/{sessionId}/complete', 'POST', 'completeB2AssessmentSession', 'submitB10AssessmentAttempt'],
]);
const EXPECTED_LEGACY_EXAM_WRITES = Object.freeze([
  ['b2-exam-session-create', '/api/v1/exam/sessions', 'POST', 'createB2ExamSession', 'HISTORICAL_ADAPTER_ONLY', 'FUTURE_EXAM_COMPATIBILITY_MIGRATION'],
  ['b2-exam-heartbeat', '/api/v1/exam/sessions/{sessionId}/heartbeat', 'POST', 'b2ExamHeartbeat', 'HISTORICAL_ADAPTER_ONLY', 'FUTURE_EXAM_COMPATIBILITY_MIGRATION'],
  ['b2-exam-anti-cheat-event', '/api/v1/exam/sessions/{sessionId}/anti-cheat-events', 'POST', 'recordB2AntiCheatEvent', 'HISTORICAL_NON_AUTHORITATIVE', 'FUTURE_RISK_PRIVACY_APPEAL'],
  ['b2-exam-answer-sheet-mark', '/api/v1/exam/sessions/{sessionId}/answer-sheet/marks', 'POST', 'updateB2AnswerSheetMark', 'HISTORICAL_ADAPTER_ONLY', 'FUTURE_EXAM_COMPATIBILITY_MIGRATION'],
  ['b2-exam-checkpoint', '/api/v1/exam/sessions/{sessionId}/checkpoint', 'PUT', 'saveB2ExamCheckpoint', 'HISTORICAL_ADAPTER_ONLY', 'FUTURE_EXAM_COMPATIBILITY_MIGRATION'],
  ['b2-exam-answer-submit', '/api/v1/exam/sessions/{sessionId}/answers', 'POST', 'submitB2ExamAnswer', 'HISTORICAL_ADAPTER_ONLY', 'FUTURE_EXAM_COMPATIBILITY_MIGRATION'],
  ['b2-exam-submit', '/api/v1/exam/sessions/{sessionId}/submit', 'POST', 'submitB2Exam', 'HISTORICAL_ADAPTER_ONLY', 'FUTURE_EXAM_COMPATIBILITY_MIGRATION'],
]);
const POLICY_ROOT_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'maturity', 'runtimeStatus', 'canonicalSources', 'compatibilityPromotion', 'runtimeBoundary',
  'canonicalRoutes', 'authorization', 'states', 'pins', 'checkpoint', 'answerSubmission', 'outcome', 'report', 'ownership',
  'legacyCompatibility', 'legacyExamWriteOperations', 'events', 'phase1Prohibitions', 'scopeGroups', 'adversarialCases',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function exact(errors, actual, expected, label) {
  add(errors, stable(actual) === stable(expected), `${label} drifted`);
}

function uniqueStrings(errors, value, label, min = 0) {
  add(errors, Array.isArray(value), `${label} must be an array`);
  if (!Array.isArray(value)) return;
  add(errors, value.length >= min, `${label} must contain at least ${min} entries`);
  add(errors, value.every(nonEmptyString), `${label} must contain only non-empty strings`);
  add(errors, new Set(value).size === value.length, `${label} must be unique`);
}

function knownKeys(errors, value, allowed, label, required = allowed) {
  add(errors, isRecord(value), `${label} must be an object`);
  if (!isRecord(value)) return;
  const actual = Object.keys(value);
  const unknown = actual.filter((key) => !allowed.includes(key));
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  add(errors, unknown.length === 0, `${label} has unknown fields: ${unknown.join(', ')}`);
  add(errors, missing.length === 0, `${label} is missing required fields: ${missing.join(', ')}`);
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(root, relativePath), 'utf8'));
}

function component(doc, name) {
  return doc && doc.components && doc.components.schemas && doc.components.schemas[name];
}

function refName(ref) {
  const prefix = '#/components/schemas/';
  return typeof ref === 'string' && ref.startsWith(prefix) ? ref.slice(prefix.length) : null;
}

function dereference(doc, schema, seen = new Set()) {
  if (!isRecord(schema) || typeof schema.$ref !== 'string') return schema;
  const name = refName(schema.$ref);
  if (!name || seen.has(name)) return schema;
  const target = component(doc, name);
  return target ? dereference(doc, target, new Set([...seen, name])) : schema;
}

function flattenSchema(doc, schema, seen = new Set()) {
  const resolved = dereference(doc, schema, seen);
  if (!isRecord(resolved)) return { properties: {}, required: [], additionalProperties: undefined, oneOf: undefined, not: undefined, raw: resolved };
  const parts = [...(Array.isArray(resolved.allOf) ? resolved.allOf : []), resolved];
  const properties = {};
  const required = [];
  let additionalProperties;
  let oneOf;
  let not;
  for (const part of parts) {
    const flat = part === resolved ? part : dereference(doc, part, seen);
    if (!isRecord(flat)) continue;
    Object.assign(properties, flat.properties || {});
    for (const field of flat.required || []) if (!required.includes(field)) required.push(field);
    if (flat.additionalProperties === false) additionalProperties = false;
    if (Array.isArray(flat.oneOf)) oneOf = flat.oneOf;
    if (flat.not !== undefined) not = flat.not;
  }
  return { properties, required, additionalProperties, oneOf, not, raw: resolved };
}

function schemaHasRequired(doc, schema, fields) {
  const flat = flattenSchema(doc, schema);
  return fields.every((field) => flat.required.includes(field) && Object.hasOwn(flat.properties, field));
}

function isClosedObject(doc, schema) {
  const flat = flattenSchema(doc, schema);
  return flat.additionalProperties === false && (flat.raw.type === 'object' || Object.keys(flat.properties).length > 0);
}

function collectRefs(value, refs = new Set(), seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return refs;
  seen.add(value);
  if (typeof value.$ref === 'string') refs.add(value.$ref);
  if (Array.isArray(value)) for (const item of value) collectRefs(item, refs, seen);
  else for (const item of Object.values(value)) collectRefs(item, refs, seen);
  return refs;
}

function hasSchemaReference(value, name) {
  return collectRefs(value).has(`#/components/schemas/${name}`);
}

function operationAt(doc, route) {
  return doc && doc.paths && doc.paths[route.path] && doc.paths[route.path][route.method.toLowerCase()];
}

function operationResponseHas(operation, status, schemaName) {
  return Boolean(operation && operation.responses && operation.responses[status] && hasSchemaReference(operation.responses[status], schemaName));
}

function operationRequestHas(operation, schemaName) {
  return Boolean(operation && operation.requestBody && hasSchemaReference(operation.requestBody, schemaName));
}

function operationHasIdempotency(operation) {
  const header = (operation && operation.parameters || []).some((parameter) => parameter && parameter.in === 'header' && parameter.name === 'Idempotency-Key' && parameter.required === true);
  const extension = operation && operation['x-idempotency'];
  return header && isRecord(extension) && extension.required === true && extension.keyHeader === 'Idempotency-Key';
}

function authorizationOf(operation) {
  return operation && operation['x-authorization'];
}

function authorizationDecision(authorization) {
  return authorization && (authorization.defaultDecision ?? authorization.defaultEffect ?? authorization.default);
}

function authorizationFacts(authorization) {
  return authorization && (authorization.trustedFacts ?? authorization.requiredTrustedFacts);
}

function authorizationPep(authorization) {
  return authorization && (authorization.serviceSidePepRequired ?? authorization.pepRequired ?? authorization.serviceSidePep);
}

function authorizationSensitiveFields(authorization) {
  return authorization && (authorization.auditSensitiveFields ?? authorization.forbiddenLogFields ?? authorization.sensitiveFields);
}

function containsAll(actual, expected) {
  return Array.isArray(actual) && expected.every((value) => actual.includes(value));
}

function propertySchema(doc, schema, name) {
  return flattenSchema(doc, schema).properties[name];
}

function findPinCarrier(doc, schema, seen = new Set()) {
  const resolved = dereference(doc, schema, seen);
  if (!isRecord(resolved)) return null;
  if (schemaHasRequired(doc, resolved, ACTIVE_CONTENT_PIN_FIELDS)) return resolved;
  const flat = flattenSchema(doc, resolved);
  for (const [name, candidate] of Object.entries(flat.properties)) {
    if (!/pin/i.test(name)) continue;
    const target = dereference(doc, candidate, seen);
    if (schemaHasRequired(doc, target, ACTIVE_CONTENT_PIN_FIELDS)) return target;
  }
  return null;
}

function findSchemaWithFields(doc, schema, fields, seen = new Set()) {
  const resolved = dereference(doc, schema, seen);
  if (!isRecord(resolved)) return null;
  const name = typeof resolved.$ref === 'string' ? refName(resolved.$ref) : null;
  if (name && seen.has(name)) return null;
  if (schemaHasRequired(doc, resolved, fields)) return resolved;
  const nextSeen = name ? new Set([...seen, name]) : seen;
  const flat = flattenSchema(doc, resolved, nextSeen);
  for (const child of Object.values(flat.properties)) {
    const found = findSchemaWithFields(doc, child, fields, nextSeen);
    if (found) return found;
  }
  for (const child of flat.oneOf || []) {
    const found = findSchemaWithFields(doc, child, fields, nextSeen);
    if (found) return found;
  }
  return null;
}

function hasForbiddenPropertyDeep(doc, schema, forbidden, seen = new Set()) {
  const resolved = dereference(doc, schema, seen);
  if (!isRecord(resolved)) return false;
  const schemaRef = typeof resolved.$ref === 'string' ? refName(resolved.$ref) : null;
  if (schemaRef && seen.has(schemaRef)) return false;
  const nextSeen = schemaRef ? new Set([...seen, schemaRef]) : seen;
  const flat = flattenSchema(doc, resolved, nextSeen);
  for (const [name, child] of Object.entries(flat.properties)) {
    if (forbidden.includes(name)) return true;
    if (hasForbiddenPropertyDeep(doc, child, forbidden, nextSeen)) return true;
  }
  for (const child of flat.oneOf || []) if (hasForbiddenPropertyDeep(doc, child, forbidden, nextSeen)) return true;
  return false;
}

function enumFor(schema) {
  if (!isRecord(schema)) return undefined;
  if (Array.isArray(schema.enum)) return schema.enum;
  if (schema.const !== undefined) return [schema.const];
  return undefined;
}

function normalizedPropertyName(name) {
  return String(name).replace(/[-_]/g, '').toLowerCase();
}

function forbiddenFieldNot(fields) {
  if (fields.length === 1) return { required: [fields[0]] };
  return { anyOf: fields.map((field) => ({ required: [field] })) };
}

function hasForbiddenPayloadProperty(doc, schema, forbidden, seen = new Set()) {
  const normalizedForbidden = new Set(forbidden.map(normalizedPropertyName));
  const resolved = dereference(doc, schema, seen);
  if (!isRecord(resolved)) return false;
  const flat = flattenSchema(doc, resolved, seen);
  for (const [name, child] of Object.entries(flat.properties)) {
    if (normalizedForbidden.has(normalizedPropertyName(name))) return true;
    if (hasForbiddenPayloadProperty(doc, child, forbidden, seen)) return true;
  }
  for (const child of flat.oneOf || []) if (hasForbiddenPayloadProperty(doc, child, forbidden, seen)) return true;
  return false;
}

function findEvent(source, eventName) {
  return (source && source.events || []).find((event) => event && event.eventName === eventName);
}

function eventPayload(source, event) {
  const ref = event && event.payloadSchema && event.payloadSchema.$ref;
  const name = typeof ref === 'string' ? ref.split('/').at(-1) : null;
  return name && source && source.payloadSchemas && source.payloadSchemas[name];
}

function findGap(registry, gapId) {
  const queue = [registry];
  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
    } else if (isRecord(current)) {
      if (current.id === gapId || current.gapId === gapId) return current;
      queue.push(...Object.values(current));
    }
  }
  return null;
}

function legacyMetadata(operation) {
  return operation && (operation['x-p1r-assessment-legacy'] || operation['x-legacy-adapter'] || operation['x-compatibility']);
}

function legacyAdapterOnly(metadata) {
  return metadata && (metadata.adapterOnly === true || metadata.mode === 'ADAPTER_ONLY' || metadata.classification === 'HISTORICAL_ADAPTER_ONLY' || metadata.classification === 'HISTORICAL_NON_AUTHORITATIVE');
}

function legacyReplacement(operation, metadata) {
  return (metadata && (metadata.replacementOperationId || metadata.replacement && metadata.replacement.operationId))
    || (operation && operation['x-canonical-replacement'] && operation['x-canonical-replacement'].operationId);
}

function checkPolicy(policy, errors) {
  knownKeys(errors, policy, POLICY_ROOT_KEYS, 'assessment policy');
  if (!isRecord(policy)) return;
  add(errors, policy.$schema === 'p1r.assessment-contract.v1', 'assessment policy $schema must be p1r.assessment-contract.v1');
  add(errors, policy.schemaVersion === 'p1r.assessment-contract.v1', 'assessment policy schemaVersion must be p1r.assessment-contract.v1');
  add(errors, policy.task === 'P1R-M1-010', 'assessment policy task must be P1R-M1-010');
  add(errors, policy.phase === 'P1', 'assessment policy phase must be P1');
  add(errors, policy.maturity === 'D2_CONTRACT_READY', 'assessment policy maturity must remain D2_CONTRACT_READY');
  add(errors, policy.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'assessment policy runtimeStatus must remain NOT_RUNTIME_VERIFIED');

  knownKeys(errors, policy.canonicalSources, Object.keys(EXPECTED_SOURCE_PATHS), 'assessment policy canonicalSources');
  exact(errors, policy.canonicalSources, EXPECTED_SOURCE_PATHS, 'assessment policy canonicalSources');
  knownKeys(errors, policy.compatibilityPromotion, Object.keys(EXPECTED_COMPATIBILITY_PROMOTION), 'assessment compatibilityPromotion');
  exact(errors, policy.compatibilityPromotion, EXPECTED_COMPATIBILITY_PROMOTION, 'assessment compatibilityPromotion');

  knownKeys(errors, policy.runtimeBoundary, ['staticContractOnly', 'prohibitedRuntimeClaims'], 'assessment runtimeBoundary');
  add(errors, policy.runtimeBoundary && policy.runtimeBoundary.staticContractOnly === true, 'assessment runtimeBoundary must remain staticContractOnly');
  exact(errors, policy.runtimeBoundary && policy.runtimeBoundary.prohibitedRuntimeClaims, RUNTIME_PROHIBITED_CLAIMS, 'assessment prohibitedRuntimeClaims');

  add(errors, Array.isArray(policy.canonicalRoutes), 'assessment canonicalRoutes must be an array');
  exact(errors, policy.canonicalRoutes, REQUIRED_CANONICAL_ROUTES, 'assessment canonicalRoutes');
  for (const route of policy.canonicalRoutes || []) knownKeys(errors, route, ['id', 'path', 'method', 'operationId', 'requestSchema', 'responseSchema', 'idempotencyRequired'], `canonical route ${route && route.id}`);

  knownKeys(errors, policy.authorization, ['defaultDecision', 'trustedFacts', 'serviceSidePepRequired', 'auditSensitiveFields', 'forbiddenClientAuthorityFields'], 'assessment authorization');
  add(errors, policy.authorization && policy.authorization.defaultDecision === 'DENY', 'assessment authorization defaultDecision must be DENY');
  exact(errors, policy.authorization && policy.authorization.trustedFacts, REQUIRED_TRUSTED_FACTS, 'assessment authorization trustedFacts');
  add(errors, policy.authorization && policy.authorization.serviceSidePepRequired === true, 'assessment authorization must require service-side PEP');
  exact(errors, policy.authorization && policy.authorization.auditSensitiveFields, SENSITIVE_AUDIT_FIELDS, 'assessment auditSensitiveFields');
  exact(errors, policy.authorization && policy.authorization.forbiddenClientAuthorityFields, CLIENT_AUTHORITY_FIELDS, 'assessment forbiddenClientAuthorityFields');

  knownKeys(errors, policy.states, ['session', 'attempt', 'report'], 'assessment states');
  exact(errors, policy.states && policy.states.session, SESSION_STATES, 'assessment session states');
  exact(errors, policy.states && policy.states.attempt, ATTEMPT_STATES, 'assessment attempt states');
  exact(errors, policy.states && policy.states.report, REPORT_STATES, 'assessment report states');

  knownKeys(errors, policy.pins, ['activeContentPinRequiredFields', 'parentReplayFields', 'itemRulePinRequiredFields'], 'assessment pins');
  exact(errors, policy.pins && policy.pins.activeContentPinRequiredFields, ACTIVE_CONTENT_PIN_FIELDS, 'assessment active content pin fields');
  exact(errors, policy.pins && policy.pins.parentReplayFields, PARENT_REPLAY_FIELDS, 'assessment parent replay fields');
  exact(errors, policy.pins && policy.pins.itemRulePinRequiredFields, ITEM_RULE_PIN_FIELDS, 'assessment item rule pin fields');

  knownKeys(errors, policy.checkpoint, ['requestSchema', 'responseSchema', 'requiredFields', 'conflictHttpStatus', 'conflictPolicy'], 'assessment checkpoint');
  add(errors, policy.checkpoint && policy.checkpoint.requestSchema === 'B10AssessmentSessionCheckpointRequest', 'assessment checkpoint request schema drifted');
  add(errors, policy.checkpoint && policy.checkpoint.responseSchema === 'B10AssessmentCheckpoint', 'assessment checkpoint response schema drifted');
  exact(errors, policy.checkpoint && policy.checkpoint.requiredFields, CHECKPOINT_FIELDS, 'assessment checkpoint fields');
  add(errors, policy.checkpoint && policy.checkpoint.conflictHttpStatus === '409', 'assessment checkpoint conflict status must be 409');
  exact(errors, policy.checkpoint && policy.checkpoint.conflictPolicy, CHECKPOINT_POLICY, 'assessment checkpoint conflict policy');

  knownKeys(errors, policy.answerSubmission, ['itemSchema', 'itemRequiredFields', 'responseTypes', 'forbiddenFields', 'requiresClosedOneOf', 'requiresForbiddenNot'], 'assessment answerSubmission');
  add(errors, policy.answerSubmission && policy.answerSubmission.itemSchema === 'B10AttemptSubmission', 'assessment answer submission schema drifted');
  exact(errors, policy.answerSubmission && policy.answerSubmission.itemRequiredFields, ANSWER_ITEM_REQUIRED_FIELDS, 'assessment answer item required fields');
  exact(errors, policy.answerSubmission && policy.answerSubmission.responseTypes, ANSWER_TYPES, 'assessment answer response types');
  exact(errors, policy.answerSubmission && policy.answerSubmission.forbiddenFields, ANSWER_FORBIDDEN_FIELDS, 'assessment answer forbidden fields');
  add(errors, policy.answerSubmission && policy.answerSubmission.requiresClosedOneOf === true, 'assessment answer schema must require closed oneOf');
  add(errors, policy.answerSubmission && policy.answerSubmission.requiresForbiddenNot === true, 'assessment answer schema must require forbidden-field not guard');

  knownKeys(errors, policy.outcome, ['requiredFields', 'forbiddenClaims'], 'assessment outcome');
  exact(errors, policy.outcome && policy.outcome.requiredFields, OUTCOME_FIELDS, 'assessment outcome fields');
  exact(errors, policy.outcome && policy.outcome.forbiddenClaims, OUTCOME_FORBIDDEN_CLAIMS, 'assessment outcome forbidden claims');
  knownKeys(errors, policy.report, ['requiredFields', 'forbiddenFields'], 'assessment report');
  exact(errors, policy.report && policy.report.requiredFields, REPORT_FIELDS, 'assessment report fields');
  exact(errors, policy.report && policy.report.forbiddenFields, REPORT_FORBIDDEN_FIELDS, 'assessment report forbidden fields');
  knownKeys(errors, policy.ownership, ['assessmentOwner', 'learningDownstreamOwner', 'assessmentMustNotOwn'], 'assessment ownership');
  add(errors, policy.ownership && policy.ownership.assessmentOwner === 'assessment-service', 'assessment owner must be assessment-service');
  add(errors, policy.ownership && policy.ownership.learningDownstreamOwner === 'learning-service', 'learning downstream owner must be learning-service');
  exact(errors, policy.ownership && policy.ownership.assessmentMustNotOwn, ASSESSMENT_MUST_NOT_OWN, 'assessment forbidden ownership facts');

  checkPolicyLegacy(policy, errors);
  checkPolicyEvents(policy, errors);
  checkPolicyScope(policy, errors);
  exact(errors, policy.phase1Prohibitions, PHASE1_PROHIBITIONS, 'assessment Phase 1 prohibitions');
  exact(errors, policy.adversarialCases, EXPECTED_ADVERSARIAL_CASES, 'assessment adversarialCases');
}

function checkPolicyLegacy(policy, errors) {
  add(errors, Array.isArray(policy.legacyCompatibility), 'assessment legacyCompatibility must be an array');
  add(errors, policy.legacyCompatibility && policy.legacyCompatibility.length === EXPECTED_LEGACY_OPERATIONS.length, 'assessment legacyCompatibility length drifted');
  const legacyById = new Map((policy.legacyCompatibility || []).map((item) => [item && item.id, item]));
  for (const [id, source, pathValue, method, operationId, replacementOperationId] of EXPECTED_LEGACY_OPERATIONS) {
    const item = legacyById.get(id);
    knownKeys(errors, item, ['id', 'source', 'path', 'method', 'operationId', 'adapterOnly', 'replacementOperationId'], `legacy compatibility ${id}`);
    exact(errors, item && [item.id, item.source, item.path, item.method, item.operationId, item.replacementOperationId], [id, source, pathValue, method, operationId, replacementOperationId], `legacy compatibility ${id}`);
    add(errors, item && item.adapterOnly === true, `legacy compatibility ${id} must be adapter-only`);
  }
  add(errors, new Set((policy.legacyCompatibility || []).map((item) => item && item.id)).size === (policy.legacyCompatibility || []).length, 'assessment legacyCompatibility ids must be unique');

  add(errors, Array.isArray(policy.legacyExamWriteOperations), 'assessment legacyExamWriteOperations must be an array');
  add(errors, policy.legacyExamWriteOperations && policy.legacyExamWriteOperations.length === EXPECTED_LEGACY_EXAM_WRITES.length, 'assessment legacyExamWriteOperations length drifted');
  const examsById = new Map((policy.legacyExamWriteOperations || []).map((item) => [item && item.id, item]));
  for (const [id, pathValue, method, operationId, disposition, nextTask] of EXPECTED_LEGACY_EXAM_WRITES) {
    const item = examsById.get(id);
    const allowed = id === 'b2-exam-anti-cheat-event'
      ? ['id', 'path', 'method', 'operationId', 'adapterOnly', 'owner', 'disposition', 'nextTask', 'forbiddenEffects']
      : ['id', 'path', 'method', 'operationId', 'adapterOnly', 'owner', 'disposition', 'nextTask'];
    knownKeys(errors, item, allowed, `legacy exam operation ${id}`);
    exact(errors, item && [item.id, item.path, item.method, item.operationId, item.disposition, item.nextTask], [id, pathValue, method, operationId, disposition, nextTask], `legacy exam operation ${id}`);
    add(errors, item && item.adapterOnly === true, `legacy exam operation ${id} must be adapter-only`);
    add(errors, item && item.owner === 'assessment-service', `legacy exam operation ${id} owner must be assessment-service`);
    if (id === 'b2-exam-anti-cheat-event') exact(errors, item && item.forbiddenEffects, ['score', 'reward', 'ban'], 'legacy anti-cheat forbidden effects');
  }
  add(errors, new Set((policy.legacyExamWriteOperations || []).map((item) => item && item.id)).size === (policy.legacyExamWriteOperations || []).length, 'assessment legacyExamWriteOperations ids must be unique');
}

function checkPolicyEvents(policy, errors) {
  knownKeys(errors, policy.events, ['historicalEventNames', 'requiredSubmittedFields', 'requiredAssessedFields', 'forbiddenPayloadFields', 'objectiveOutcomeKind', 'gapId', 'gapStatus'], 'assessment events');
  exact(errors, policy.events && policy.events.historicalEventNames, ['assessment.attempt.submitted.v1', 'assessment.attempt.assessed.v1'], 'assessment historical event names');
  exact(errors, policy.events && policy.events.requiredSubmittedFields, SUBMITTED_EVENT_FIELDS, 'assessment submitted event fields');
  exact(errors, policy.events && policy.events.requiredAssessedFields, ASSESSED_EVENT_FIELDS, 'assessment assessed event fields');
  exact(errors, policy.events && policy.events.forbiddenPayloadFields, EVENT_FORBIDDEN_FIELDS, 'assessment event forbidden payload fields');
  add(errors, policy.events && policy.events.objectiveOutcomeKind === 'OBJECTIVE', 'assessment assessed event outcomeKind must be OBJECTIVE');
  add(errors, policy.events && policy.events.gapId === 'EVENT-GAP-BIND-ASM-001', 'assessment event gap id drifted');
  add(errors, policy.events && policy.events.gapStatus === 'OPEN', 'assessment event gap must remain OPEN');
}

function checkPolicyScope(policy, errors) {
  add(errors, Array.isArray(policy.scopeGroups), 'assessment scopeGroups must be an array');
  const expectedIds = Array.from({ length: 52 }, (_, index) => `ASM-${String(215 + index).padStart(4, '0')}`);
  const allowedScopeIds = [
    'assessment-contract', 'non-authoritative-security-candidate', 'prohibited-product-claim', 'downstream-learning-and-ui', 'placement-plan-inputs',
  ];
  const expectedDisposition = {
    'assessment-contract': ['assessment-service', 'IN_SCOPE_CANONICAL_CONTRACT', 'P1R-M1-010'],
    'non-authoritative-security-candidate': ['future-risk-privacy-appeal-owner', 'OUT_OF_SCOPE_NON_AUTHORITATIVE_ONLY', 'FUTURE_RISK_PRIVACY_APPEAL'],
    'prohibited-product-claim': ['legal-rights-approval', 'PROHIBITED_PENDING_AUTHORIZATION', 'FUTURE_LEGAL_RIGHTS_APPROVAL'],
    'downstream-learning-and-ui': ['learning-service/gamification-service/UI', 'OUT_OF_SCOPE_DOWNSTREAM', 'P1R-M1-013/M4'],
    'placement-plan-inputs': ['learning-service', 'OUT_OF_SCOPE_PLACEMENT_PLAN_INPUT', 'P1R-M1-012'],
  };
  const allAsmIds = [];
  const ids = [];
  for (const group of policy.scopeGroups || []) {
    knownKeys(errors, group, ['id', 'asmIds', 'scope', 'downstreamOwner', 'disposition', 'nextTask'], `assessment scope group ${group && group.id}`);
    ids.push(group && group.id);
    add(errors, nonEmptyString(group && group.scope), `assessment scope group ${group && group.id} scope must be a non-empty string`);
    uniqueStrings(errors, group && group.asmIds, `assessment scope group ${group && group.id} asmIds`, 1);
    allAsmIds.push(...(group && group.asmIds || []));
    const expected = expectedDisposition[group && group.id];
    add(errors, Boolean(expected), `assessment scope group ${group && group.id} is not allowed`);
    if (expected) exact(errors, [group.downstreamOwner, group.disposition, group.nextTask], expected, `assessment scope group ${group.id} disposition`);
  }
  exact(errors, ids.sort(), [...allowedScopeIds].sort(), 'assessment scope group ids');
  add(errors, new Set(allAsmIds).size === allAsmIds.length, 'assessment ASM ids must not be duplicated across scope groups');
  exact(errors, [...allAsmIds].sort(), expectedIds, 'assessment ASM-0215..0266 coverage');
}

function checkCanonicalRoutes(b10OpenApi, canonicalOpenApi, errors) {
  for (const route of REQUIRED_CANONICAL_ROUTES) {
    const operation = operationAt(b10OpenApi, route);
    add(errors, isRecord(operation), `B10 canonical ${route.method} ${route.path} is required`);
    if (!isRecord(operation)) continue;
    add(errors, operation.operationId === route.operationId, `B10 canonical ${route.path} operationId must be ${route.operationId}`);
    add(errors, operation.deprecated !== true, `B10 canonical ${route.operationId} must not be deprecated`);
    if (route.requestSchema) add(errors, operationRequestHas(operation, route.requestSchema), `B10 canonical ${route.operationId} must use ${route.requestSchema}`);
    add(errors, operationResponseHas(operation, route.id === 'assessment-session-create' ? '201' : '200', route.responseSchema) || operationResponseHas(operation, '202', route.responseSchema), `B10 canonical ${route.operationId} must return ${route.responseSchema}`);
    if (route.idempotencyRequired) add(errors, operationHasIdempotency(operation), `B10 canonical ${route.operationId} must require Idempotency-Key`);
    const authorization = authorizationOf(operation);
    add(errors, isRecord(authorization), `B10 canonical ${route.operationId} must declare x-authorization`);
    add(errors, authorizationDecision(authorization) === 'DENY', `B10 canonical ${route.operationId} must default DENY`);
    add(errors, containsAll(authorizationFacts(authorization), REQUIRED_TRUSTED_FACTS), `B10 canonical ${route.operationId} must require trusted facts`);
    add(errors, authorizationPep(authorization) === true || authorizationPep(authorization) === 'REQUIRED', `B10 canonical ${route.operationId} must require service-side PEP`);
    add(errors, containsAll(authorizationSensitiveFields(authorization), SENSITIVE_AUDIT_FIELDS), `B10 canonical ${route.operationId} must lock audit-sensitive fields`);

    const canonicalOperation = operationAt(canonicalOpenApi, route);
    add(errors, isRecord(canonicalOperation), `composed OpenAPI must contain ${route.operationId}`);
    add(errors, canonicalOperation && canonicalOperation.operationId === route.operationId, `composed OpenAPI operationId drifted for ${route.operationId}`);
  }
}

function checkSchemas(b10OpenApi, errors) {
  const session = component(b10OpenApi, 'B10AssessmentSession');
  const attempt = component(b10OpenApi, 'B10Attempt');
  const report = component(b10OpenApi, 'B10AssessmentReport');
  const checkpointRequest = component(b10OpenApi, 'B10AssessmentSessionCheckpointRequest');
  const checkpoint = component(b10OpenApi, 'B10AssessmentCheckpoint');
  const answer = component(b10OpenApi, 'B10AttemptSubmission');
  for (const [name, value] of [['B10AssessmentSession', session], ['B10Attempt', attempt], ['B10AssessmentReport', report], ['B10AssessmentSessionCheckpointRequest', checkpointRequest], ['B10AssessmentCheckpoint', checkpoint], ['B10AttemptSubmission', answer]]) {
    add(errors, isRecord(value), `${name} schema is required`);
    add(errors, isClosedObject(b10OpenApi, value), `${name} must be a closed object`);
  }

  checkStateSchema(b10OpenApi, session, SESSION_STATES, 'B10AssessmentSession', errors);
  checkStateSchema(b10OpenApi, attempt, ATTEMPT_STATES, 'B10Attempt', errors);
  checkStateSchema(b10OpenApi, report, REPORT_STATES, 'B10AssessmentReport', errors);
  checkStatePayloadMutualExclusion(b10OpenApi, attempt, report, errors);
  checkOutcomeVariants(b10OpenApi, errors);
  for (const [name, value] of [['B10AssessmentSession', session], ['B10Attempt', attempt], ['B10AssessmentReport', report]]) {
    const pin = findPinCarrier(b10OpenApi, value);
    add(errors, Boolean(pin), `${name} must carry an immutable assessment pin`);
    add(errors, pin && schemaHasRequired(b10OpenApi, pin, ACTIVE_CONTENT_PIN_FIELDS), `${name} active content pin must retain the frozen content lifecycle fields`);
    add(errors, pin && isClosedObject(b10OpenApi, pin), `${name} pin must be a closed object`);
    add(errors, schemaHasRequired(b10OpenApi, value, PARENT_REPLAY_FIELDS), `${name} must carry parent replay rule fields`);
    const itemRulePins = propertySchema(b10OpenApi, value, 'itemRulePins');
    const itemRulePin = itemRulePins && itemRulePins.items;
    add(errors, itemRulePins && itemRulePins.type === 'array' && itemRulePins.minItems >= 1, `${name} itemRulePins must be a non-empty array`);
    add(errors, itemRulePin && schemaHasRequired(b10OpenApi, itemRulePin, ITEM_RULE_PIN_FIELDS), `${name} itemRulePins must pin answerRuleVersion and ruleDigest per item`);
    add(errors, itemRulePin && isClosedObject(b10OpenApi, itemRulePin), `${name} itemRulePins entries must be closed`);
  }
  add(errors, schemaHasRequired(b10OpenApi, attempt, ['submissionId', 'submissionDigest', 'attemptVersion']), 'B10Attempt must bind submissionId, submissionDigest and attemptVersion');
  add(errors, schemaHasRequired(b10OpenApi, report, REPORT_FIELDS), 'B10AssessmentReport must bind immutable report versions and watermark');
  add(errors, !hasForbiddenPropertyDeep(b10OpenApi, report, REPORT_FORBIDDEN_FIELDS), 'B10AssessmentReport must not own mastery, schedule, percentile or certification');

  add(errors, schemaHasRequired(b10OpenApi, checkpointRequest, CHECKPOINT_FIELDS), 'session checkpoint request must include protected draft, state/version/client sequence and digest');
  const protectedDraft = propertySchema(b10OpenApi, checkpointRequest, 'protectedDraft');
  add(errors, protectedDraft && (protectedDraft.writeOnly === true || protectedDraft['x-protected'] === true || protectedDraft['x-sensitive'] === true || protectedDraft.xProtected === true || protectedDraft.xSensitive === true), 'session checkpoint protectedDraft must be protected from response/log sinks');
  add(errors, schemaHasRequired(b10OpenApi, checkpoint, ['sessionId', 'checkpointVersion', 'checkpointDigest']), 'session checkpoint response must bind session/version/digest');

  const checkpointRoute = REQUIRED_CANONICAL_ROUTES.find((route) => route.id === 'assessment-session-checkpoint');
  const checkpointOperation = operationAt(b10OpenApi, checkpointRoute);
  const conflict = checkpointOperation && (checkpointOperation['x-checkpoint-concurrency'] || checkpointOperation['x-concurrency']);
  add(errors, checkpointOperation && checkpointOperation.responses && checkpointOperation.responses['409'], 'session checkpoint must declare a 409 response');
  exact(errors, conflict, CHECKPOINT_POLICY, 'session checkpoint replay/conflict policy');

  const answerFlat = flattenSchema(b10OpenApi, answer);
  add(errors, schemaHasRequired(b10OpenApi, answer, ANSWER_ITEM_REQUIRED_FIELDS), 'answer submission must retain item identity, sequence, response type and digest');
  add(errors, Array.isArray(answerFlat.oneOf) && answerFlat.oneOf.length === ANSWER_TYPES.length, 'answer submission must have exactly six oneOf branches');
  const branchTypes = (answerFlat.oneOf || []).map((branch) => {
    const flat = flattenSchema(b10OpenApi, branch);
    const discriminator = flat.properties.responseType || flat.properties.type;
    return enumFor(discriminator) && enumFor(discriminator)[0];
  });
  exact(errors, [...branchTypes].sort(), [...ANSWER_TYPES].sort(), 'answer submission response type union');
  add(errors, (answerFlat.oneOf || []).every((branch) => isClosedObject(b10OpenApi, branch)), 'every answer response oneOf branch must be closed');
  exact(errors, answerFlat.not, forbiddenFieldNot(ANSWER_FORBIDDEN_FIELDS), 'answer submission forbidden-field not guard');
  add(errors, !hasForbiddenPayloadProperty(b10OpenApi, answer, ANSWER_FORBIDDEN_FIELDS), 'answer submission must reject client score/rule authority');

  const outcome = findSchemaWithFields(b10OpenApi, report, OUTCOME_FIELDS) || findSchemaWithFields(b10OpenApi, attempt, OUTCOME_FIELDS);
  add(errors, Boolean(outcome), 'assessment attempt/report must expose a learner-safe objective outcome');
  add(errors, outcome && isClosedObject(b10OpenApi, outcome), 'learner-safe objective outcome must be closed');
  const reasonTrace = outcome && propertySchema(b10OpenApi, outcome, 'reasonTrace');
  const reasonResolved = dereference(b10OpenApi, reasonTrace);
  add(errors, reasonResolved && (reasonResolved.type === 'object' || reasonResolved.type === 'array'), 'reasonTrace must be structured rather than a scalar claim');
  for (const field of ['objectiveNumerator', 'objectiveDenominator']) {
    const fieldSchema = outcome && propertySchema(b10OpenApi, outcome, field);
    add(errors, fieldSchema && ['integer', 'number'].includes(dereference(b10OpenApi, fieldSchema).type), `${field} must be numeric`);
  }
  add(errors, outcome && !hasForbiddenPropertyDeep(b10OpenApi, outcome, ['selfRating', 'subjectiveScore', 'mastery', 'masterySignal', 'aiScore']), 'subjective/self-rating, mastery or AI must not impersonate objective outcome');
}

function checkStateSchema(doc, schema, expected, label, errors) {
  const state = propertySchema(doc, schema, 'status') || propertySchema(doc, schema, 'state');
  exact(errors, enumFor(dereference(doc, state)), expected, `${label} status enum`);
}

function stateBranch(doc, schema, expectedStatuses) {
  const flat = flattenSchema(doc, schema);
  return (flat.oneOf || []).find((branch) => {
    const branchFlat = flattenSchema(doc, branch);
    return stable(enumFor(dereference(doc, branchFlat.properties.status))) === stable(expectedStatuses);
  });
}

function checkStateBranch(doc, schema, expectedStatuses, required, forbidden, label, errors) {
  const branch = stateBranch(doc, schema, expectedStatuses);
  add(errors, isRecord(branch), `${label} branch is required`);
  if (!isRecord(branch)) return;
  const flat = flattenSchema(doc, branch);
  exact(errors, flat.required, required, `${label} required fields`);
  exact(errors, flat.not, forbiddenFieldNot(forbidden), `${label} forbidden fields`);
}

function checkStatePayloadMutualExclusion(doc, attempt, report, errors) {
  const attemptFlat = flattenSchema(doc, attempt);
  add(errors, Array.isArray(attemptFlat.oneOf) && attemptFlat.oneOf.length === 3, 'B10Attempt must have three fail-closed status branches');
  checkStateBranch(doc, attempt, ['ACCEPTED', 'ASSESSING'], ['status'], [...ATTEMPT_ASSESSED_FIELDS, 'rejectionCode'], 'B10Attempt ACCEPTED/ASSESSING', errors);
  checkStateBranch(doc, attempt, ['ASSESSED'], ['status', ...ATTEMPT_ASSESSED_FIELDS], ['rejectionCode'], 'B10Attempt ASSESSED', errors);
  checkStateBranch(doc, attempt, ['REJECTED'], ['status', 'rejectionCode'], ATTEMPT_ASSESSED_FIELDS, 'B10Attempt REJECTED', errors);

  const reportFlat = flattenSchema(doc, report);
  add(errors, Array.isArray(reportFlat.oneOf) && reportFlat.oneOf.length === 4, 'B10AssessmentReport must have four fail-closed status branches');
  checkStateBranch(doc, report, ['GENERATING'], ['status'], REPORT_GENERATING_FORBIDDEN_FIELDS, 'B10AssessmentReport GENERATING', errors);
  checkStateBranch(doc, report, ['READY'], ['status', 'outcome', 'mistakeCodes'], REPORT_READY_FORBIDDEN_FIELDS, 'B10AssessmentReport READY', errors);
  checkStateBranch(doc, report, ['PARTIAL'], ['status', 'outcome', 'partialReasonCodes'], REPORT_PARTIAL_FORBIDDEN_FIELDS, 'B10AssessmentReport PARTIAL', errors);
  checkStateBranch(doc, report, ['FAILED'], ['status', 'failureCode', 'retryable'], REPORT_FAILED_FORBIDDEN_FIELDS, 'B10AssessmentReport FAILED', errors);
}

function checkOutcomeVariants(doc, errors) {
  const union = component(doc, 'B10AssessmentOutcome');
  const unionFlat = flattenSchema(doc, union);
  add(errors, isRecord(union) && Array.isArray(unionFlat.oneOf) && unionFlat.oneOf.length === 3, 'B10AssessmentOutcome must have OBJECTIVE, SELF_RATING and MANUAL_REVIEW branches');
  const objective = component(doc, 'B10ObjectiveOutcome');
  const selfRating = component(doc, 'B10SelfRatingOutcome');
  const manualReview = component(doc, 'B10ManualReviewOutcome');
  for (const [label, schema, kind, required, forbidden] of [
    ['OBJECTIVE', objective, 'OBJECTIVE', ['outcomeKind', ...OUTCOME_FIELDS], ['selfRating', 'reviewStatus']],
    ['SELF_RATING', selfRating, 'SELF_RATING', ['outcomeKind', 'selfRating', 'outcomeDigest'], OBJECTIVE_ONLY_OUTCOME_FIELDS],
    ['MANUAL_REVIEW', manualReview, 'MANUAL_REVIEW', ['outcomeKind', 'reviewStatus', 'outcomeDigest'], OBJECTIVE_ONLY_OUTCOME_FIELDS],
  ]) {
    add(errors, isClosedObject(doc, schema), `B10 ${label} outcome must be closed`);
    add(errors, schemaHasRequired(doc, schema, required), `B10 ${label} outcome required fields drifted`);
    exact(errors, enumFor(dereference(doc, propertySchema(doc, schema, 'outcomeKind'))), [kind], `B10 ${label} outcome kind`);
    add(errors, !hasForbiddenPropertyDeep(doc, schema, forbidden), `B10 ${label} outcome must not impersonate another outcome kind`);
  }
}

function checkLegacyOperations(b10OpenApi, b2OpenApi, policy, errors) {
  for (const item of policy.legacyCompatibility || []) {
    const source = item.source === 'B10' ? b10OpenApi : b2OpenApi;
    const route = { path: item.path, method: item.method };
    const operation = operationAt(source, route);
    add(errors, isRecord(operation), `legacy ${item.id} must exist in ${item.source} source fragment`);
    add(errors, operation && operation.operationId === item.operationId, `legacy ${item.id} operationId drifted`);
    add(errors, operation && operation.deprecated === true, `legacy ${item.id} must be deprecated`);
    exact(errors, operation && operation['x-p1r-deprecation'], LEGACY_DEPRECATION, `legacy ${item.id} deprecation declaration`);
    const metadata = legacyMetadata(operation);
    add(errors, legacyAdapterOnly(metadata), `legacy ${item.id} must be adapter-only`);
    add(errors, legacyReplacement(operation, metadata) === item.replacementOperationId, `legacy ${item.id} replacement must be ${item.replacementOperationId}`);
  }

  const configuredB2Assessment = new Set((policy.legacyCompatibility || []).filter((item) => item.source === 'B2').map((item) => item.operationId));
  for (const [pathValue, pathItem] of Object.entries(b2OpenApi && b2OpenApi.paths || {})) {
    if (!pathValue.startsWith('/api/v1/assessment/')) continue;
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!HTTP_WRITE_METHODS.has(method) || !isRecord(operation)) continue;
      add(errors, configuredB2Assessment.has(operation.operationId), `B2 assessment write ${operation.operationId} must be explicitly listed as legacy adapter-only`);
      add(errors, operation.deprecated === true, `B2 assessment write ${operation.operationId} must be deprecated`);
    }
  }

  for (const item of policy.legacyExamWriteOperations || []) {
    const route = { path: item.path, method: item.method };
    const operation = operationAt(b2OpenApi, route);
    add(errors, isRecord(operation), `legacy exam ${item.id} must exist in B2 source fragment`);
    add(errors, operation && operation.operationId === item.operationId, `legacy exam ${item.id} operationId drifted`);
    add(errors, operation && operation.deprecated === true, `legacy exam ${item.id} must be deprecated`);
    exact(errors, operation && operation['x-p1r-deprecation'], LEGACY_DEPRECATION, `legacy exam ${item.id} deprecation declaration`);
    const metadata = legacyMetadata(operation);
    add(errors, legacyAdapterOnly(metadata), `legacy exam ${item.id} must be adapter-only`);
    add(errors, metadata && metadata.owner === item.owner, `legacy exam ${item.id} owner metadata drifted`);
    add(errors, metadata && metadata.disposition === item.disposition, `legacy exam ${item.id} disposition metadata drifted`);
    add(errors, metadata && metadata.nextTask === item.nextTask, `legacy exam ${item.id} nextTask metadata drifted`);
    if (item.operationId === 'recordB2AntiCheatEvent') exact(errors, metadata && metadata.forbiddenEffects, ['score', 'reward', 'ban'], 'legacy anti-cheat source forbidden effects');
  }
}

function checkEvents(eventFragment, catalog, gapRegistry, errors) {
  for (const [eventName, fields] of [
    ['assessment.attempt.submitted.v1', SUBMITTED_EVENT_FIELDS],
    ['assessment.attempt.assessed.v1', ASSESSED_EVENT_FIELDS],
  ]) {
    const fragmentEvent = findEvent(eventFragment, eventName);
    const catalogEvent = findEvent(catalog, eventName);
    add(errors, isRecord(fragmentEvent), `${eventName} must exist in historical event fragment`);
    add(errors, isRecord(catalogEvent), `${eventName} must exist in catalog`);
    add(errors, catalogEvent && catalogEvent.status === 'HISTORICAL_CANDIDATE', `${eventName} must remain HISTORICAL_CANDIDATE`);
    add(errors, fragmentEvent && (!fragmentEvent.status || fragmentEvent.status === 'HISTORICAL_CANDIDATE'), `${eventName} fragment must not promote canonical status`);
    add(errors, catalogEvent && catalogEvent.status !== 'CANONICAL_D2', `${eventName} must not be promoted canonical`);
    const fragmentPayload = eventPayload(eventFragment, fragmentEvent);
    const catalogPayload = eventPayload(catalog, catalogEvent);
    add(errors, isRecord(fragmentPayload), `${eventName} fragment payload is required`);
    add(errors, isRecord(catalogPayload), `${eventName} catalog payload is required`);
    add(errors, fragmentPayload && fragmentPayload.additionalProperties === false, `${eventName} fragment payload must be closed`);
    add(errors, catalogPayload && catalogPayload.additionalProperties === false, `${eventName} catalog payload must be closed`);
    add(errors, fragmentPayload && fields.every((field) => (fragmentPayload.required || []).includes(field) && Object.hasOwn(fragmentPayload.properties || {}, field)), `${eventName} fragment payload must retain safe pin/submission/version/outcome fields`);
    add(errors, catalogPayload && fields.every((field) => (catalogPayload.required || []).includes(field) && Object.hasOwn(catalogPayload.properties || {}, field)), `${eventName} catalog payload must retain safe pin/submission/version/outcome fields`);
    add(errors, fragmentPayload && !hasForbiddenPayloadProperty({ components: { schemas: {} } }, fragmentPayload, EVENT_FORBIDDEN_FIELDS), `${eventName} fragment payload must not leak raw response/rule/recording`);
    add(errors, catalogPayload && !hasForbiddenPayloadProperty({ components: { schemas: {} } }, catalogPayload, EVENT_FORBIDDEN_FIELDS), `${eventName} catalog payload must not leak raw response/rule/recording`);
    if (eventName.endsWith('assessed.v1')) {
      exact(errors, fragmentPayload && enumFor(fragmentPayload.properties && fragmentPayload.properties.outcomeKind), ['OBJECTIVE'], `${eventName} fragment outcomeKind`);
      exact(errors, catalogPayload && enumFor(catalogPayload.properties && catalogPayload.properties.outcomeKind), ['OBJECTIVE'], `${eventName} catalog outcomeKind`);
      const reasonTrace = catalogPayload && catalogPayload.properties && catalogPayload.properties.reasonTrace;
      add(errors, reasonTrace && ['object', 'array'].includes(reasonTrace.type), `${eventName} reasonTrace must remain structured`);
    }
  }
  const canonicalAssessmentEvents = (catalog && catalog.events || []).filter((event) => event && event.status === 'CANONICAL_D2' && String(event.eventName).startsWith('assessment.'));
  add(errors, canonicalAssessmentEvents.length === 0, 'assessment historical events must not be promoted into canonical governance');
  const gap = findGap(gapRegistry, 'EVENT-GAP-BIND-ASM-001');
  add(errors, isRecord(gap), 'EVENT-GAP-BIND-ASM-001 must remain registered');
  add(errors, gap && gap.status === 'OPEN', 'EVENT-GAP-BIND-ASM-001 must remain OPEN');
  add(errors, gap && Array.isArray(gap.closureTasks) && ['P1R-M1-006', 'P1R-M1-010', 'P1R-M1-013'].every((task) => gap.closureTasks.includes(task)), 'EVENT-GAP-BIND-ASM-001 must retain collective closure tasks');
  add(errors, gap && (gap.closureEvidence === null || gap.closureEvidence === undefined), 'EVENT-GAP-BIND-ASM-001 must not have closure evidence at D2');
}

function checkPhaseBoundary(b10OpenApi, errors) {
  const prohibitedProperties = ['aiScore', 'aiAssessment', 'mastery', 'masterySignal', 'officialCertification', 'nationwidePercentile', 'cheatingConclusion', 'antiCheatDecision', 'reward', 'ban'];
  for (const route of REQUIRED_CANONICAL_ROUTES) {
    const operation = operationAt(b10OpenApi, route);
    if (!operation) continue;
    const responseSchema = component(b10OpenApi, route.responseSchema);
    add(errors, !hasForbiddenPropertyDeep(b10OpenApi, responseSchema, prohibitedProperties), `${route.operationId} must not expose prohibited Phase 1 authority fields`);
  }
}

export function validateAssessmentContractData(input = {}) {
  const errors = [];
  for (const [key, label] of [
    ['policy', 'assessment policy'], ['b10OpenApi', 'B10 OpenAPI'], ['b2OpenApi', 'B2 OpenAPI'], ['canonicalOpenApi', 'composed OpenAPI'],
    ['eventFragment', 'B10 historical event fragment'], ['catalog', 'event catalog'], ['gapRegistry', 'P1R gap registry'],
  ]) add(errors, isRecord(input[key]), `${label} must be an object`);
  if (errors.length === 0) {
    checkPolicy(input.policy, errors);
    checkCanonicalRoutes(input.b10OpenApi, input.canonicalOpenApi, errors);
    checkSchemas(input.b10OpenApi, errors);
    checkLegacyOperations(input.b10OpenApi, input.b2OpenApi, input.policy, errors);
    checkEvents(input.eventFragment, input.catalog, input.gapRegistry, errors);
    checkPhaseBoundary(input.b10OpenApi, errors);
  }
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    summary: {
      taskId: input.policy && input.policy.task,
      maturity: input.policy && input.policy.maturity,
      runtimeStatus: input.policy && input.policy.runtimeStatus,
      canonicalRoutes: input.policy && input.policy.canonicalRoutes && input.policy.canonicalRoutes.length || 0,
      adversarialCases: input.policy && input.policy.adversarialCases && input.policy.adversarialCases.length || 0,
      eventPromotion: 'HISTORICAL_PAYLOADS_ONLY_NO_CANONICAL_PROMOTION',
    },
    errors,
  };
}

export function readAssessmentContractInputs(options = {}) {
  const root = options.root || defaultRoot;
  return {
    policy: readJson(root, DEFAULT_ASSESSMENT_POLICY),
    b10OpenApi: readJson(root, DEFAULT_B10_OPENAPI),
    b2OpenApi: readJson(root, DEFAULT_B2_OPENAPI),
    canonicalOpenApi: readJson(root, DEFAULT_CANONICAL_OPENAPI),
    eventFragment: readJson(root, DEFAULT_EVENT_FRAGMENT),
    catalog: readJson(root, DEFAULT_EVENT_CATALOG),
    gapRegistry: readJson(root, DEFAULT_GAP_REGISTRY),
  };
}

export function validateAssessmentContract(options = {}) {
  return validateAssessmentContractData(readAssessmentContractInputs(options));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const report = validateAssessmentContract();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`P1R assessment contract ${report.result} (${report.summary.canonicalRoutes} canonical routes, ${report.summary.adversarialCases} adversarial cases, runtimeStatus=${report.summary.runtimeStatus || 'UNKNOWN'}).`);
      for (const error of report.errors) console.error(`- ${error}`);
    }
    if (report.result !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
