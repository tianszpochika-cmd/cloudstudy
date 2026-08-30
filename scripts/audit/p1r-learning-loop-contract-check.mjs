import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..', '..');

export const DEFAULT_LEARNING_LOOP_POLICY = 'config/p1r-learning-loop-contract.v1.json';
export const DEFAULT_M1014_CURRENT_SOURCE_POLICY = 'config/p1r-gamification-social-contract.v1.json';
export const DEFAULT_B10_OPENAPI = 'packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json';
export const DEFAULT_B1_OPENAPI = 'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json';
export const DEFAULT_B9_OPENAPI = 'packages/contracts/fragments/b9/b9-learner.openapi.json';
export const DEFAULT_B2_COMPATIBILITY_OPENAPI = 'packages/contracts/fragments/b2-compatibility.openapi.json';
export const DEFAULT_B2_SRS_OPENAPI = 'packages/contracts/fragments/b2-vocabulary-srs.openapi.json';
export const DEFAULT_B2_MASTERY_OPENAPI = 'packages/contracts/fragments/b2-assessment-mastery.openapi.json';
export const DEFAULT_B10_EVENT_FRAGMENT = 'packages/contracts/events/v1/fragments/b10-learning-assessment.events.json';
export const DEFAULT_B10_LEARNING_LOOP_EVENT_FRAGMENT = 'packages/contracts/events/v1/fragments/b10-learning-loop.events.json';
export const DEFAULT_B2_SRS_EVENT_FRAGMENT = 'packages/contracts/events/v1/fragments/b2-vocabulary-srs.events.json';
export const DEFAULT_B2_MASTERY_EVENT_FRAGMENT = 'packages/contracts/events/v1/fragments/b2-assessment-mastery.events.json';
export const DEFAULT_EVENT_CATALOG = 'packages/contracts/events/v1/catalog.json';
export const DEFAULT_B26_RUNTIME = 'config/b26-event-runtime.json';
export const DEFAULT_GENERATED_OPENAPI = 'packages/contracts/generated/openapi.ts';
export const DEFAULT_GENERATED_EVENTS = 'packages/contracts/generated/events.ts';
export const DEFAULT_GENERATED_INDEX = 'packages/contracts/generated/index.ts';
export const DEFAULT_GENERATED_SCHEMAS = 'packages/contracts/generated/schemas.ts';
export const DEFAULT_GENERATED_API_CLIENT = 'packages/api-client/src/generated/index.ts';

// Deliberately frozen after the rule-model author completed its invariant review.
// Candidate policy content is never accepted by calculating a replacement value at runtime.
export const FROZEN_POLICY_SHA256 = 'd1e467d8697f9f873c5ac3b45fa7c5a39085c9b975dfd3abbffac251d5847973';

const SOURCE_BASELINE = 'a07a58a7d245295c54d39487a6669545d077c513';
const ROOT_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'sourceBaseline', 'maturity', 'runtimeStatus',
  'collectionPolicy', 'canonicalSources', 'compatibilityPromotion', 'firstDayProjection', 'runtimeBoundary', 'rulePackages',
  'ownership', 'dailyPlan', 'srs', 'repair', 'mastery', 'report', 'offlineAndIdempotency',
  'deferredEventCandidates', 'adversarialCases',
]);
const COLLECTION_POLICY = Object.freeze({
  unknownFieldDecision: 'DENY',
  unknownEnumDecision: 'DENY',
  stableOrderingRequired: true,
  localeDependentOrdering: 'PROHIBITED',
  clientAuthorityExpansion: 'PROHIBITED',
});
const CANONICAL_SOURCES = Object.freeze({
  businessRules: 'docs/06-design/v2-980plus/phase1-business-operation/04-学习机制与学习引擎规则.md',
  journeys: 'docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md',
  recoveryMatrix: 'docs/06-design/v2-980plus/phase1-business-operation/07-状态权限异常恢复矩阵.md',
  assessmentContract: 'config/p1r-assessment-contract.v1.json',
  learnerPlanningContract: 'config/p1r-learner-planning-contract.v1.json',
  b9FirstDayProjectionFragment: DEFAULT_B9_OPENAPI,
  b1OnboardingFragment: DEFAULT_B1_OPENAPI,
  b10Fragment: DEFAULT_B10_OPENAPI,
  b2CompatibilityFragment: DEFAULT_B2_COMPATIBILITY_OPENAPI,
  b2SrsFragment: DEFAULT_B2_SRS_OPENAPI,
  b2MasteryFragment: DEFAULT_B2_MASTERY_OPENAPI,
  b10HistoricalEventFragment: DEFAULT_B10_EVENT_FRAGMENT,
  b10LearningLoopEventFragment: DEFAULT_B10_LEARNING_LOOP_EVENT_FRAGMENT,
  b2SrsHistoricalEventFragment: DEFAULT_B2_SRS_EVENT_FRAGMENT,
  b2MasteryHistoricalEventFragment: DEFAULT_B2_MASTERY_EVENT_FRAGMENT,
  eventCatalog: DEFAULT_EVENT_CATALOG,
  eventReliabilityPolicy: 'packages/contracts/events/v1/reliability-policy.json',
  b26RuntimeContract: DEFAULT_B26_RUNTIME,
});
const COMPATIBILITY_PROMOTION = Object.freeze({
  id: 'P1R-M1-013',
  sourceContractBaseline: SOURCE_BASELINE,
  previousPromotion: 'P1R-M1-012',
  immutableGovernanceBaseline: '868c2177f62b6d2cf613bed702686dddcfe6943f',
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  scope: 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC',
  approvedSourceFiles: [
    DEFAULT_B1_OPENAPI,
    DEFAULT_B10_OPENAPI,
    DEFAULT_B2_COMPATIBILITY_OPENAPI,
    DEFAULT_B2_SRS_OPENAPI,
    DEFAULT_B2_MASTERY_OPENAPI,
    DEFAULT_B10_LEARNING_LOOP_EVENT_FRAGMENT,
    DEFAULT_EVENT_CATALOG,
    'packages/contracts/events/v1/reliability-policy.json',
    DEFAULT_B26_RUNTIME,
  ],
  historicalOnlySources: [
    'getB2DailyStream', 'submitReviewEvent', 'syncReviewEvents', 'getB2DailyReport', 'getB2WeeklyReport',
    'assessment.attempt.assessed.v1', 'learning.mastery.projected.v1', 'learning.review.scheduled.v1',
    'vocabulary.review.accepted.v1', 'vocabulary.srs.state_changed.v1',
    'mastery.verification_state_changed.v1', 'report.generated.v1',
  ],
  prohibitedRuntimeClaims: [
    'http-execution-verified', 'database-persistence-verified', 'kafka-delivery-verified', 'consumer-processing-verified',
    'gateway-pep-runtime-verified', 'b26-go', 'runtime-ready',
  ],
});
const COMPATIBILITY_PROMOTION_KEYS = Object.freeze([
  ...Object.keys(COMPATIBILITY_PROMOTION), 'approvedCanonicalEvents', 'canonicalRoutes', 'legacyAdapters',
]);
const RUNTIME_CLAIMS = Object.freeze([
  'learning-service-http-executed',
  'assessment-service-to-learning-service-delivery-verified',
  'mysql-plan-srs-repair-mastery-report-persisted',
  'outbox-or-kafka-delivery-verified',
  'workflow-saga-or-dlq-replay-verified',
  'gateway-or-resource-server-pep-verified',
  'browser-or-device-offline-e2e-verified',
]);
const RULE_PACKAGES = Object.freeze({
  dailyPlan: 'P1_DAILY_PLAN_V1',
  session: 'P1_SESSION_V1',
  srs: 'SM2_Q03_V1',
  repair: 'P1_MISTAKE_REPAIR_V1',
  mastery: 'P1_MASTERY_V1',
  report: 'P1_REPORT_V1',
  timeSync: 'P1_TIME_SYNC_V1',
});
const DAILY_QUOTAS = Object.freeze([5, 15, 30, 45]);
const PRIORITY_CLASSES = Object.freeze([
  { ordinal: 1, code: 'RECOVERY_REQUIRED', mandatory: true },
  { ordinal: 2, code: 'DELAY_VERIFICATION_DUE', mandatory: true },
  { ordinal: 3, code: 'SRS_OVERDUE_OR_DUE', mandatory: true },
  { ordinal: 4, code: 'MISTAKE_REPAIR', mandatory: false },
  { ordinal: 5, code: 'GOAL_CRITICAL', mandatory: false },
  { ordinal: 6, code: 'NEW_CORE', mandatory: false },
  { ordinal: 7, code: 'OPTIONAL', mandatory: false },
]);
const NORMAL_BUDGETS = Object.freeze([
  { dailyQuotaMinutes: 5, reviewRepairMinutes: 2, goalNewMinutes: 2, skillRotationMinutes: 1, totalCapMinutes: 6 },
  { dailyQuotaMinutes: 15, reviewRepairMinutes: 6, goalNewMinutes: 6, skillRotationMinutes: 3, totalCapMinutes: 17 },
  { dailyQuotaMinutes: 30, reviewRepairMinutes: 12, goalNewMinutes: 12, skillRotationMinutes: 6, totalCapMinutes: 33 },
  { dailyQuotaMinutes: 45, reviewRepairMinutes: 18, goalNewMinutes: 18, skillRotationMinutes: 9, totalCapMinutes: 50 },
]);
const SRS_STAGES = Object.freeze(['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED']);
const REPAIR_STATES = Object.freeze(['REVIEW_QUEUE', 'LEARNING', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED', 'REOPENED']);
const MASTERY_STAGES = Object.freeze(['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED']);
const FORBIDDEN_CLIENT_AUTHORITY = Object.freeze([
  'tenantId', 'principalId', 'ownerId', 'objectiveOutcome', 'effectiveQuality', 'score', 'mastery',
  'srsStage', 'easeFactor', 'intervalDays', 'dueAt', 'algorithmVersion', 'pass', 'fail',
]);
const REQUIRED_OFFLINE_FIELDS = Object.freeze(['clientEventId', 'clientSeq', 'baseStateVersion', 'contentVersionId', 'payloadHash', 'rawQuality']);
const SRS_OBJECTIVE_OUTCOMES = Object.freeze([
  'CORRECT_VERIFIED', 'INCORRECT', 'UNANSWERED', 'REVEALED_BEFORE_ANSWER', 'GUESSED', 'NO_OBJECTIVE_EXPECTED',
]);
const NO_OBJECTIVE_EXPECTED_AUTHORITY = Object.freeze({
  unknownOutcomeDecision: 'REJECT',
  objectiveExpected: Object.freeze({
    requiredPracticeType: 'OBJECTIVE_ASSESSMENT',
    requiredObjectiveExpected: true,
  }),
  noObjectiveExpected: Object.freeze({
    requiredAuthority: 'SERVER_PREDECLARED_LEGAL_PRACTICE_TYPE',
    requiredTrustedContextFields: Object.freeze(['authority', 'objectivePolicyPin']),
    objectivePolicyPinRequiredFields: Object.freeze(['practiceType', 'objectiveExpected', 'policyVersion', 'policyDigest']),
    allowedPracticeTypes: Object.freeze(['SPEAKING_SELF_RATING', 'WRITING_SELF_RATING', 'ACTIVE_RECALL_SELF_RATING']),
    requiredObjectiveExpected: false,
    policyDigestPattern: '^[A-Fa-f0-9]{64}$',
    clientClaimDecision: 'REJECT',
  }),
});
const SRS_STATE_VALIDATION = Object.freeze({
  easeFactor: Object.freeze({ minimum: '1.30', maximum: '2.50', maxDecimalPlaces: 2 }),
  intervalDays: Object.freeze({ minimum: 0, maximum: 365 }),
  repetitions: Object.freeze({ minimum: 0 }),
  lapseCount: Object.freeze({ minimum: 0 }),
});
const OFFLINE_COMMAND_CONSTRAINTS = Object.freeze({
  clientEventIdPattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$',
  clientSeq: Object.freeze({ minimum: 1 }),
  baseStateVersion: Object.freeze({ minimum: 0 }),
  contentVersionId: Object.freeze({ minimum: 1 }),
  payloadHashPattern: '^[a-f0-9]{64}$',
  rawQualityValues: Object.freeze([0, 1, 2, 3]),
});
const OFFLINE_REPLAY_POLICY = Object.freeze({
  sameEventSamePayload: 'REPLAY_ORIGINAL_RECEIPT',
  sameEventDifferentPayload: 'CONFLICT_409',
  clientSeqOrdering: 'STRICTLY_INCREASING_PER_DEDUPE_SCOPE',
});
const REPORT_SNAPSHOT_VALIDATION = Object.freeze({
  timestampFormat: 'UTC_RFC3339_Z',
  watermarkPattern: '^[A-Za-z0-9._:-]+$',
  digestPattern: '^[a-f0-9]{64}$',
  rateMultiplier: 100,
  rateDecimalPlaces: 2,
  processingMetricStatus: 'PROCESSING',
});
const ASSESSMENT_OBJECTIVE_POLICY_PIN_DESCRIPTION = 'Assessment-service server-predeclared proof that determines whether an item is objective-scored. Clients cannot create, override or widen this pin.';
const ASSESSMENT_CROSS_FIELD_INVARIANTS = Object.freeze([
  'objectivePolicyPin is an assessment-service server-predeclared proof; policyVersion and policyDigest identify the immutable legal practice policy',
  'objectiveOutcome=NO_OBJECTIVE_EXPECTED => objectivePolicyPin.objectiveExpected=false and objectivePolicyPin.practiceType in [SPEAKING_SELF_RATING,WRITING_SELF_RATING,ACTIVE_RECALL_SELF_RATING]',
  'objectiveOutcome!=NO_OBJECTIVE_EXPECTED => objectivePolicyPin.objectiveExpected=true and objectivePolicyPin.practiceType=OBJECTIVE_ASSESSMENT',
  'NO_OBJECTIVE_EXPECTED is legal only when objectiveNumerator=0, objectiveDenominator=0, objectiveCorrect=false and guessSignal=false',
]);
const ASSESSMENT_OBJECTIVE_OUTCOME_BRANCHES = Object.freeze([
  Object.freeze({ properties: Object.freeze({
    objectivePolicyPin: Object.freeze({ properties: Object.freeze({ objectiveExpected: Object.freeze({ enum: Object.freeze([true]) }), practiceType: Object.freeze({ enum: Object.freeze(['OBJECTIVE_ASSESSMENT']) }) }) }),
    objectiveOutcome: Object.freeze({ const: 'CORRECT_VERIFIED' }), objectiveNumerator: Object.freeze({ const: 1 }), objectiveDenominator: Object.freeze({ const: 1 }), objectiveCorrect: Object.freeze({ const: true }), guessSignal: Object.freeze({ const: false }),
  }) }),
  Object.freeze({ properties: Object.freeze({
    objectivePolicyPin: Object.freeze({ properties: Object.freeze({ objectiveExpected: Object.freeze({ enum: Object.freeze([true]) }), practiceType: Object.freeze({ enum: Object.freeze(['OBJECTIVE_ASSESSMENT']) }) }) }),
    objectiveOutcome: Object.freeze({ const: 'INCORRECT' }), objectiveNumerator: Object.freeze({ const: 0 }), objectiveDenominator: Object.freeze({ const: 1 }), objectiveCorrect: Object.freeze({ const: false }), guessSignal: Object.freeze({ const: false }),
  }) }),
  Object.freeze({ properties: Object.freeze({
    objectivePolicyPin: Object.freeze({ properties: Object.freeze({ objectiveExpected: Object.freeze({ enum: Object.freeze([true]) }), practiceType: Object.freeze({ enum: Object.freeze(['OBJECTIVE_ASSESSMENT']) }) }) }),
    objectiveOutcome: Object.freeze({ const: 'UNANSWERED' }), objectiveNumerator: Object.freeze({ const: 0 }), objectiveDenominator: Object.freeze({ const: 1 }), objectiveCorrect: Object.freeze({ const: false }), guessSignal: Object.freeze({ const: false }),
  }) }),
  Object.freeze({ properties: Object.freeze({
    objectivePolicyPin: Object.freeze({ properties: Object.freeze({ objectiveExpected: Object.freeze({ enum: Object.freeze([true]) }), practiceType: Object.freeze({ enum: Object.freeze(['OBJECTIVE_ASSESSMENT']) }) }) }),
    objectiveOutcome: Object.freeze({ const: 'REVEALED_BEFORE_ANSWER' }), objectiveNumerator: Object.freeze({ const: 0 }), objectiveDenominator: Object.freeze({ const: 1 }), objectiveCorrect: Object.freeze({ const: false }), guessSignal: Object.freeze({ const: false }),
  }) }),
  Object.freeze({ properties: Object.freeze({
    objectivePolicyPin: Object.freeze({ properties: Object.freeze({ objectiveExpected: Object.freeze({ enum: Object.freeze([true]) }), practiceType: Object.freeze({ enum: Object.freeze(['OBJECTIVE_ASSESSMENT']) }) }) }),
    objectiveOutcome: Object.freeze({ const: 'GUESSED' }), objectiveNumerator: Object.freeze({ const: 1 }), objectiveDenominator: Object.freeze({ const: 1 }), objectiveCorrect: Object.freeze({ const: true }), guessSignal: Object.freeze({ const: true }),
  }) }),
  Object.freeze({ properties: Object.freeze({
    objectivePolicyPin: Object.freeze({ properties: Object.freeze({ objectiveExpected: Object.freeze({ enum: Object.freeze([true]) }), practiceType: Object.freeze({ enum: Object.freeze(['OBJECTIVE_ASSESSMENT']) }) }) }),
    objectiveOutcome: Object.freeze({ const: 'GUESSED' }), objectiveNumerator: Object.freeze({ const: 0 }), objectiveDenominator: Object.freeze({ const: 1 }), objectiveCorrect: Object.freeze({ const: false }), guessSignal: Object.freeze({ const: true }),
  }) }),
  Object.freeze({ properties: Object.freeze({
    objectivePolicyPin: Object.freeze({ properties: Object.freeze({ objectiveExpected: Object.freeze({ enum: Object.freeze([false]) }), practiceType: Object.freeze({ enum: Object.freeze(['SPEAKING_SELF_RATING', 'WRITING_SELF_RATING', 'ACTIVE_RECALL_SELF_RATING']) }) }) }),
    objectiveOutcome: Object.freeze({ const: 'NO_OBJECTIVE_EXPECTED' }), objectiveNumerator: Object.freeze({ const: 0 }), objectiveDenominator: Object.freeze({ const: 0 }), objectiveCorrect: Object.freeze({ const: false }), guessSignal: Object.freeze({ const: false }),
  }) }),
]);
const MASTERY_CROSS_FIELD_INVARIANTS = Object.freeze([
  'masteryStageAfter=MASTERED => d7Gate.result=PASSED and d7Gate.reasonCode=D7_PASSED and evidenceCount=3 and evidenceLocalDates.length=3 and aggregateScore>=85',
  'masteryStageAfter=CONSOLIDATED => d7Gate.result=PASSED and d7Gate.reasonCode=D7_PASSED and evidenceCount=3 and evidenceLocalDates.length=3 and aggregateScore>=95 and latestEffectiveQuality=3 and latestGuessSignal=false',
  'evidenceCount=length(evidenceLocalDates); evidenceLocalDates are unique and sorted by ISO local date ascending',
  'reasonTrace is sorted by Unicode code-point tuple (ruleCode,reasonCode,evidenceRef) ascending',
]);
const MASTERY_CROSS_FIELD_BRANCHES = Object.freeze([
  Object.freeze({ title: 'MASTERED_GATE', properties: Object.freeze({
    masteryStageAfter: Object.freeze({ enum: Object.freeze(['MASTERED']) }),
    d7Gate: Object.freeze({ required: Object.freeze(['result', 'reasonCode']), properties: Object.freeze({ result: Object.freeze({ enum: Object.freeze(['PASSED']) }), reasonCode: Object.freeze({ enum: Object.freeze(['D7_PASSED']) }) }) }),
    evidenceCount: Object.freeze({ minimum: 3, maximum: 3 }), evidenceLocalDates: Object.freeze({ minItems: 3, maxItems: 3 }), aggregateScore: Object.freeze({ minimum: 85 }),
  }) }),
  Object.freeze({ title: 'CONSOLIDATED_GATE', properties: Object.freeze({
    masteryStageAfter: Object.freeze({ enum: Object.freeze(['CONSOLIDATED']) }),
    d7Gate: Object.freeze({ required: Object.freeze(['result', 'reasonCode']), properties: Object.freeze({ result: Object.freeze({ enum: Object.freeze(['PASSED']) }), reasonCode: Object.freeze({ enum: Object.freeze(['D7_PASSED']) }) }) }),
    evidenceCount: Object.freeze({ minimum: 3, maximum: 3 }), evidenceLocalDates: Object.freeze({ minItems: 3, maxItems: 3 }), aggregateScore: Object.freeze({ minimum: 95 }), latestEffectiveQuality: Object.freeze({ enum: Object.freeze([3]) }), latestGuessSignal: Object.freeze({ enum: Object.freeze([false]) }),
  }) }),
  Object.freeze({ title: 'NON_MASTERED_PROJECTION', properties: Object.freeze({ masteryStageAfter: Object.freeze({ enum: Object.freeze(['NEW', 'LEARNING']) }) }) }),
]);
const MASTERY_EVIDENCE_COUNT_BRANCHES = Object.freeze([
  Object.freeze({ properties: Object.freeze({ evidenceCount: Object.freeze({ enum: Object.freeze([0]) }), evidenceLocalDates: Object.freeze({ maxItems: 0 }) }) }),
  Object.freeze({ properties: Object.freeze({ evidenceCount: Object.freeze({ enum: Object.freeze([1]) }), evidenceLocalDates: Object.freeze({ minItems: 1, maxItems: 1 }) }) }),
  Object.freeze({ properties: Object.freeze({ evidenceCount: Object.freeze({ enum: Object.freeze([2]) }), evidenceLocalDates: Object.freeze({ minItems: 2, maxItems: 2 }) }) }),
  Object.freeze({ properties: Object.freeze({ evidenceCount: Object.freeze({ enum: Object.freeze([3]) }), evidenceLocalDates: Object.freeze({ minItems: 3, maxItems: 3 }) }) }),
]);
const MASTERY_D7_GATE_BRANCHES = Object.freeze([
  Object.freeze({ properties: Object.freeze({ result: Object.freeze({ const: 'NOT_DUE' }), reasonCode: Object.freeze({ const: 'D7_NOT_DUE' }) }) }),
  Object.freeze({ properties: Object.freeze({ result: Object.freeze({ const: 'NOT_PASSED' }), reasonCode: Object.freeze({ const: 'D7_NOT_PASSED' }) }) }),
  Object.freeze({ properties: Object.freeze({ result: Object.freeze({ const: 'NOT_PASSED' }), reasonCode: Object.freeze({ const: 'MASTERY_GATE_NOT_MET' }) }) }),
  Object.freeze({ properties: Object.freeze({ result: Object.freeze({ const: 'PASSED' }), reasonCode: Object.freeze({ const: 'D7_PASSED' }) }) }),
  Object.freeze({ properties: Object.freeze({ result: Object.freeze({ const: 'FAILED' }), reasonCode: Object.freeze({ const: 'D7_FAILED' }) }) }),
]);
const REVIEW_CROSS_FIELD_INVARIANTS = Object.freeze([
  'repairWorkflowState=DELAY_VERIFY_D1 => reasonCodes contains D1_VERIFICATION',
  'repairWorkflowState=DELAY_VERIFY_D7 => reasonCodes contains D7_VERIFICATION',
  'repairWorkflowState=MASTERED => masteryStage in [MASTERED,CONSOLIDATED] and reasonCodes contains D7_VERIFICATION',
  'repairWorkflowState=REOPENED => masteryStage=LEARNING and reasonCodes contains D1_VERIFICATION or D7_VERIFICATION or CATCH_UP_PROTECTION',
  'repairWorkflowState in [REVIEW_QUEUE,LEARNING] has no cross-state coupling; srsStage, repairWorkflowState and masteryStage remain independent',
  'reasonCodes are unique and sorted by Unicode code-point ascending',
]);
const REVIEW_CROSS_FIELD_BRANCHES = Object.freeze([
  Object.freeze({ title: 'D1_VERIFICATION_QUEUE', properties: Object.freeze({ repairWorkflowState: Object.freeze({ enum: Object.freeze(['DELAY_VERIFY_D1']) }), reasonCodes: Object.freeze({ contains: Object.freeze({ enum: Object.freeze(['D1_VERIFICATION']) }) }) }) }),
  Object.freeze({ title: 'D7_VERIFICATION_QUEUE', properties: Object.freeze({ repairWorkflowState: Object.freeze({ enum: Object.freeze(['DELAY_VERIFY_D7']) }), reasonCodes: Object.freeze({ contains: Object.freeze({ enum: Object.freeze(['D7_VERIFICATION']) }) }) }) }),
  Object.freeze({ title: 'MASTERED_REPAIR_QUEUE', properties: Object.freeze({ repairWorkflowState: Object.freeze({ enum: Object.freeze(['MASTERED']) }), masteryStage: Object.freeze({ enum: Object.freeze(['MASTERED', 'CONSOLIDATED']) }), reasonCodes: Object.freeze({ contains: Object.freeze({ enum: Object.freeze(['D7_VERIFICATION']) }) }) }) }),
  Object.freeze({ title: 'REOPENED_REPAIR_QUEUE', properties: Object.freeze({ repairWorkflowState: Object.freeze({ enum: Object.freeze(['REOPENED']) }), masteryStage: Object.freeze({ enum: Object.freeze(['LEARNING']) }), reasonCodes: Object.freeze({ contains: Object.freeze({ enum: Object.freeze(['D1_VERIFICATION', 'D7_VERIFICATION', 'CATCH_UP_PROTECTION']) }) }) }) }),
  Object.freeze({ title: 'ACTIVE_REVIEW_QUEUE', properties: Object.freeze({ repairWorkflowState: Object.freeze({ enum: Object.freeze(['REVIEW_QUEUE', 'LEARNING']) }) }) }),
]);
const DEFERRED_EVENT_CANDIDATES = Object.freeze([
  Object.freeze({
    eventName: 'learning.plan.generated.v1', owner: 'learning-service', aggregateType: 'learning_plan', partitionKey: 'planId',
    dedupeKey: 'planningInputDigest + planVersion', requiredPayloadPurpose: 'PLAN_VERSION_PINS_AND_LEARNER_SAFE_REASON_SUMMARY',
    disposition: 'OWNER_LOCAL_UNLESS_FUTURE_CROSS_SERVICE_CONSUMER', status: 'NOT_CANONICAL',
  }),
  Object.freeze({
    eventName: 'learning.today_stream.materialized.v1', owner: 'learning-service', aggregateType: 'today_stream', partitionKey: 'streamId',
    dedupeKey: 'candidateSnapshotDigest + streamRevision', requiredPayloadPurpose: 'STREAM_VERSION_BUDGET_AND_SAFE_REASON_SUMMARY',
    disposition: 'OWNER_LOCAL_UNLESS_FUTURE_CROSS_SERVICE_CONSUMER', status: 'NOT_CANONICAL',
  }),
  Object.freeze({
    eventName: 'learning.srs.review.accepted.v1', owner: 'learning-service', aggregateType: 'srs_state', partitionKey: 'logicalItemId',
    dedupeKey: 'reviewFactId + stateVersionAfter', requiredPayloadPurpose: 'QUALITY_CAP_ALGORITHM_VERSION_STATE_TRANSITION_AND_DUE_AT_WITHOUT_RAW_ANSWER',
    disposition: 'OWNER_LOCAL_UNLESS_FUTURE_CROSS_SERVICE_CONSUMER', status: 'NOT_CANONICAL',
  }),
  Object.freeze({
    eventName: 'learning.srs.state.changed.v2', owner: 'learning-service', aggregateType: 'srs_state', partitionKey: 'logicalItemId',
    dedupeKey: 'stateVersionAfter', requiredPayloadPurpose: 'SRS_STAGE_ONLY_NEVER_REPAIR_OR_MASTERY_STAGE',
    disposition: 'OWNER_LOCAL_UNLESS_FUTURE_CROSS_SERVICE_CONSUMER', status: 'NOT_CANONICAL',
  }),
  Object.freeze({
    eventName: 'learning.repair.state.changed.v1', owner: 'learning-service', aggregateType: 'repair_item', partitionKey: 'repairId',
    dedupeKey: 'repairId + repairVersion', requiredPayloadPurpose: 'REPAIR_WORKFLOW_VARIANT_AND_D1_D7_SCHEDULE',
    disposition: 'OWNER_LOCAL_UNLESS_FUTURE_CROSS_SERVICE_CONSUMER', status: 'NOT_CANONICAL',
  }),
  Object.freeze({
    eventName: 'learning.report.snapshot.created.v1', owner: 'learning-service', aggregateType: 'learning_report', partitionKey: 'reportId',
    dedupeKey: 'reportKey + reportVersion', requiredPayloadPurpose: 'WATERMARK_VECTOR_METRIC_DEFINITIONS_AND_REBUILD_LINEAGE',
    disposition: 'OWNER_LOCAL_UNLESS_FUTURE_CROSS_SERVICE_CONSUMER', status: 'NOT_CANONICAL',
  }),
]);
const APPROVED_CANONICAL_EVENTS = Object.freeze([
  Object.freeze({
    eventName: 'assessment.item.assessed.v2',
    payloadRef: '#/payloadSchemas/B10AssessmentItemAssessedV2',
    topic: 'platform.assessment.v1',
    producer: 'assessment-service',
    aggregateType: 'assessment_item',
    aggregateIdField: 'itemAssessmentId',
    requiredPayloadFields: Object.freeze([
      'tenantId', 'principalId', 'itemAssessmentId', 'attemptId', 'sessionId', 'logicalItemId', 'contentPin', 'rulePin', 'reportPin', 'objectivePolicyPin',
      'objectiveOutcome', 'objectiveNumerator', 'objectiveDenominator', 'objectiveCorrect', 'guessSignal', 'semanticErrorCategory',
      'mappingVersion', 'verificationStage', 'reasonTrace', 'outcomeDigest', 'assessmentFactWatermark', 'assessedAt',
    ]),
    consumers: Object.freeze([
      Object.freeze({ service: 'learning-service', consumerGroup: 'cg.learning-from-assessment.v1' }),
      Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-assessment.v1' }),
    ]),
  }),
  Object.freeze({
    eventName: 'learning.mastery.projected.v2',
    payloadRef: '#/payloadSchemas/B10LearningMasteryProjectedV2',
    topic: 'platform.learning.v1',
    producer: 'learning-service',
    aggregateType: 'mastery_projection',
    aggregateIdField: 'projectionId',
    requiredPayloadFields: Object.freeze([
      'tenantId', 'principalId', 'projectionId', 'logicalItemId', 'sourceAssessmentEventId', 'sourceItemAssessmentId', 'contentPin',
      'masteryStageBefore', 'masteryStageAfter', 'evidenceCount', 'evidenceDigest', 'evidenceLocalDates', 'd7Gate', 'aggregateScore',
      'latestEffectiveQuality', 'latestGuessSignal', 'masteryEpochId', 'masteryEpochVersion', 'projectionVersion', 'masteryRuleVersion',
      'masteryFactWatermark', 'reasonTrace', 'projectedAt',
    ]),
    consumers: Object.freeze([
      Object.freeze({ service: 'assessment-service', consumerGroup: 'cg.assessment-from-learning.v1' }),
      Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-learning.v1' }),
    ]),
  }),
  Object.freeze({
    eventName: 'learning.review.scheduled.v2',
    payloadRef: '#/payloadSchemas/B10LearningReviewScheduledV2',
    topic: 'platform.learning.v1',
    producer: 'learning-service',
    aggregateType: 'learning_review_queue',
    aggregateIdField: 'queueItemId',
    requiredPayloadFields: Object.freeze([
      'tenantId', 'principalId', 'queueItemId', 'logicalItemId', 'queueVersion', 'srsStage', 'repairWorkflowState', 'masteryStage',
      'sourceAssessmentEventId', 'sourceItemAssessmentId', 'algorithmVersion', 'timePolicyVersion', 'contentPin', 'dueLocalDate', 'dueAt',
      'timezoneId', 'reasonCodes', 'scheduledAt',
    ]),
    consumers: Object.freeze([
      Object.freeze({ service: 'assessment-service', consumerGroup: 'cg.assessment-from-learning.v1' }),
      Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-learning.v1' }),
    ]),
  }),
]);
// M1-013 remains frozen at the policy above.  These are the only two event
// consumer projections that may be revalidated against the reviewed current
// M1-014 source.  This is deliberately not a merge rule: the source policy
// digest and every listed consumer pair are pinned so an arbitrary new
// consumer cannot become accepted by changing a current-source document.
const M1_014_CURRENT_SOURCE_REVALIDATION = Object.freeze({
  policyDigest: 'b4860e3aad81f207fb2a2ff51be2b86ca1f1bdb01123d0d600f921a9846f46cb',
  policy: Object.freeze({
    $schema: 'p1r.gamification-social-contract.v1',
    schemaVersion: 'p1r.gamification-social-contract.v1',
    task: 'P1R-M1-014',
    phase: 'P1',
    sourceBaseline: 'e3514c359e6f6be5445cf46a7734325b2835b941',
    maturity: 'D2_CONTRACT_READY',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    promotion: Object.freeze({
      id: 'P1R-M1-014',
      sourceContractBaseline: 'e3514c359e6f6be5445cf46a7734325b2835b941',
      previousPromotion: 'P1R-M1-013',
      immutableGovernanceBaseline: '868c2177f62b6d2cf613bed702686dddcfe6943f',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      scope: 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC',
    }),
    runtimeBoundary: Object.freeze({
      contractOnly: true,
      runtimeEvidence: 'NOT_RUNTIME_VERIFIED',
    }),
  }),
  events: Object.freeze([
    Object.freeze({
      eventName: 'assessment.item.assessed.v2',
      consumers: Object.freeze([
        Object.freeze({ service: 'learning-service', consumerGroup: 'cg.learning-from-assessment.v1' }),
        Object.freeze({ service: 'gamification-service', consumerGroup: 'cg.gamification-from-assessment.v1' }),
        Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-assessment.v1' }),
      ]),
    }),
    Object.freeze({
      eventName: 'learning.mastery.projected.v2',
      consumers: Object.freeze([
        Object.freeze({ service: 'assessment-service', consumerGroup: 'cg.assessment-from-learning.v1' }),
        Object.freeze({ service: 'gamification-service', consumerGroup: 'cg.gamification-from-learning.v1' }),
        Object.freeze({ service: 'social-service', consumerGroup: 'cg.social-from-learning.v1' }),
        Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-learning.v1' }),
      ]),
    }),
  ]),
});
// This is deliberately a source-bound M1-013 inventory, rather than an
// inventory of every adapter in the repository. M1-010 and M1-011 own other
// adapter-only operations; their compatibility chains verify those operations
// independently and they must not become implicit M1-013 promotion scope.
const M1_013_LEGACY_OPERATION_SET = Object.freeze([
  [DEFAULT_B1_OPENAPI, 'getB1DailyTasks'],
  [DEFAULT_B1_OPENAPI, 'completeB1DailyTask'],
  [DEFAULT_B1_OPENAPI, 'reorderB1DailyTasks'],
  [DEFAULT_B2_COMPATIBILITY_OPENAPI, 'getCurrentLearningPlan'],
  [DEFAULT_B2_COMPATIBILITY_OPENAPI, 'getTodayLearningStream'],
  [DEFAULT_B2_COMPATIBILITY_OPENAPI, 'submitLearningStreamAction'],
  [DEFAULT_B2_COMPATIBILITY_OPENAPI, 'getLearningMistakeQueue'],
  [DEFAULT_B2_COMPATIBILITY_OPENAPI, 'verifyLearningMistake'],
  [DEFAULT_B2_COMPATIBILITY_OPENAPI, 'getDailyLearningSummary'],
  [DEFAULT_B2_SRS_OPENAPI, 'createSrsBatch'],
  [DEFAULT_B2_SRS_OPENAPI, 'getSrsBatch'],
  [DEFAULT_B2_SRS_OPENAPI, 'submitReviewEvent'],
  [DEFAULT_B2_SRS_OPENAPI, 'syncReviewEvents'],
  [DEFAULT_B2_SRS_OPENAPI, 'listSrsStates'],
  [DEFAULT_B2_SRS_OPENAPI, 'getSrsOverview'],
  [DEFAULT_B2_MASTERY_OPENAPI, 'getB2DailyStream'],
  [DEFAULT_B2_MASTERY_OPENAPI, 'getB2MasteryOverview'],
  [DEFAULT_B2_MASTERY_OPENAPI, 'listB2Mistakes'],
  [DEFAULT_B2_MASTERY_OPENAPI, 'getB2MistakeDetail'],
  [DEFAULT_B2_MASTERY_OPENAPI, 'startB2MistakeRetry'],
  [DEFAULT_B2_MASTERY_OPENAPI, 'listB2MasteryVerifications'],
  [DEFAULT_B2_MASTERY_OPENAPI, 'submitB2MasteryVerification'],
  [DEFAULT_B2_MASTERY_OPENAPI, 'getB2DailyReport'],
  [DEFAULT_B2_MASTERY_OPENAPI, 'getB2WeeklyReport'],
].map(([sourceFragment, operationId]) => Object.freeze({ sourceFragment, operationId })));
const LEGACY_ROUTE_EXAMPLE_OPERATION_IDS = new Set([
  'getDailyLearningSummary',
  'getB2DailyReport',
  'getB2WeeklyReport',
]);
const M1_010_DAILY_STREAM_DEPRECATION = Object.freeze({
  deprecationAt: '2026-08-30T00:00:00Z',
  sunsetAt: 'UNSCHEDULED_UNTIL_DECLARED_REPLACEMENT_RUNTIME_GATE_ACCEPTED',
  migrationLink: '/docs/07-operations/b10-validation#legacy-adapter-retirement',
});
const FIRST_DAY_PROJECTION_CONTRACT = Object.freeze({
  sourceFragment: DEFAULT_B9_OPENAPI,
  operationId: 'getB9FirstDayProjection',
  responseSchema: 'B9FirstDayProjection',
  ready: Object.freeze({ taskCountMinimum: 1, tasksMinItems: 1 }),
  degraded: Object.freeze({ reasonField: 'degradedReason' }),
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function stableJsonDigest(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function same(left, right) {
  return stableJson(left) === stableJson(right);
}

function exact(errors, actual, expected, label) {
  add(errors, same(actual, expected), `${label} must exactly match the frozen M1-013 rule model`);
}

function exactPinnedCurrentSource(errors, actual, expected, label) {
  const matches = same(actual, expected);
  add(errors, matches, `${label} must exactly match the pinned current M1-014 source`);
  return matches;
}

function exactCurrentSourceConsumerRevalidation(errors, actual, expected, label) {
  add(errors, same(actual, expected), `${label} must exactly match the source-bound M1-014 consumer revalidation`);
}

function exactKeys(errors, value, expected, label) {
  add(errors, isRecord(value), `${label} must be an object`);
  if (isRecord(value)) exact(errors, Object.keys(value).sort(), [...expected].sort(), `${label} keys`);
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readExistingJson(root, relativePath, errors, label) {
  try {
    return readJson(root, relativePath);
  } catch (error) {
    errors.push(`${label} must be readable at ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function readExistingText(root, relativePath, errors, label) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch (error) {
    errors.push(`${label} must be readable at ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function eventEntry(document, eventName) {
  return (document?.events ?? []).find((entry) => entry?.eventName === eventName);
}

function routeOperation(document, operationId) {
  for (const [routePath, pathItem] of Object.entries(document?.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (operation?.operationId === operationId) return { routePath, method: method.toUpperCase(), operation };
    }
  }
  return undefined;
}

function operationAt(document, route) {
  return document?.paths?.[route?.path]?.[String(route?.method ?? '').toLowerCase()];
}

function schemaByReference(document, reference) {
  if (typeof reference !== 'string' || !reference.startsWith('#/components/schemas/')) return undefined;
  return document?.components?.schemas?.[reference.slice('#/components/schemas/'.length)];
}

function containsReference(value, target, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (value.$ref === target) return true;
  return Object.values(value).some((child) => containsReference(child, target, seen));
}

function responseSchema(operation) {
  const status = Object.keys(operation?.responses ?? {}).sort().find((code) => /^2\d\d$/.test(code));
  return operation?.responses?.[status]?.content?.['application/json']?.schema;
}

function requiredBearerSecurity(operation) {
  return same(operation?.security, [{ bearerAuth: [] }]);
}

function fragmentDocument(input, sourceFragment) {
  const fragments = new Map([
    [DEFAULT_B1_OPENAPI, input.b1OpenApi],
    [DEFAULT_B2_COMPATIBILITY_OPENAPI, input.b2CompatibilityOpenApi],
    [DEFAULT_B2_SRS_OPENAPI, input.b2SrsOpenApi],
    [DEFAULT_B2_MASTERY_OPENAPI, input.b2MasteryOpenApi],
  ]);
  return fragments.get(sourceFragment);
}

function allOperations(document) {
  return Object.entries(document?.paths ?? {}).flatMap(([routePath, pathItem]) => Object.entries(pathItem ?? {})
    .filter(([method, operation]) => ['get', 'put', 'post', 'patch', 'delete'].includes(method) && isRecord(operation))
    .map(([method, operation]) => ({ routePath, method: method.toUpperCase(), operation })));
}

function b26Route(document, eventName) {
  return (document?.eventRouting ?? []).find((entry) => entry?.eventName === eventName);
}

function hasCanonicalClaim(value) {
  if (!isRecord(value)) return false;
  return value.status === 'CANONICAL_D2'
    || value.runtimeStatus === 'RUNTIME_VERIFIED'
    || value?.['x-p1r-governance']?.status === 'CANONICAL_D2'
    || value?.['x-p1r-governance']?.runtimeStatus === 'RUNTIME_VERIFIED';
}

function exactPolicyRoot(policy, errors, frozenPolicyDigest) {
  exactKeys(errors, policy, ROOT_KEYS, 'learning loop policy');
  exact(errors, policy?.$schema, 'p1r.learning-loop-contract.v1', 'policy schema');
  exact(errors, policy?.schemaVersion, 'p1r.learning-loop-contract.v1', 'policy schemaVersion');
  exact(errors, policy?.task, 'P1R-M1-013', 'policy task');
  exact(errors, policy?.phase, 'P1', 'policy phase');
  exact(errors, policy?.sourceBaseline, SOURCE_BASELINE, 'policy source baseline');
  exact(errors, policy?.maturity, 'D2_CONTRACT_READY', 'policy maturity');
  exact(errors, policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'policy runtime status');
  exact(errors, policy?.collectionPolicy, COLLECTION_POLICY, 'collection policy');
  exact(errors, policy?.canonicalSources, CANONICAL_SOURCES, 'canonical source inventory');

  if (typeof frozenPolicyDigest !== 'string' || !/^[a-f0-9]{64}$/.test(frozenPolicyDigest)) {
    errors.push('M1-013 frozen policy digest is not set; fail closed rather than dynamically accepting the policy');
  } else {
    exact(errors, stableJsonDigest(policy), frozenPolicyDigest, 'learning loop policy digest');
  }
}

function checkCompatibilityPromotion(policy, errors) {
  const promotion = policy?.compatibilityPromotion;
  exactKeys(errors, promotion, COMPATIBILITY_PROMOTION_KEYS, 'compatibility promotion');
  const {
    approvedCanonicalEvents: _approvedCanonicalEvents,
    canonicalRoutes: _canonicalRoutes,
    legacyAdapters: _legacyAdapters,
    ...fixedPromotion
  } = isRecord(promotion) ? promotion : {};
  exact(errors, fixedPromotion, COMPATIBILITY_PROMOTION, 'compatibility promotion fixed boundary');
  exact(errors, promotion?.scope, 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC', 'compatibility promotion static D2 scope');
}

function checkFirstDayProjectionPolicy(policy, errors) {
  exactKeys(errors, policy?.firstDayProjection, Object.keys(FIRST_DAY_PROJECTION_CONTRACT), 'first-day projection policy');
  exact(errors, policy?.firstDayProjection, FIRST_DAY_PROJECTION_CONTRACT, 'first-day projection policy');
}

function checkRuntimeBoundary(policy, errors) {
  exactKeys(errors, policy?.runtimeBoundary, ['staticContractOnly', 'prohibitedRuntimeClaims'], 'runtime boundary');
  exact(errors, policy?.runtimeBoundary?.staticContractOnly, true, 'runtime boundary staticContractOnly');
  exact(errors, policy?.runtimeBoundary?.prohibitedRuntimeClaims, RUNTIME_CLAIMS, 'runtime prohibited claims');
}

function checkOwnership(policy, errors) {
  const ownership = policy?.ownership;
  exactKeys(errors, ownership, [
    'learningService', 'assessmentService', 'contentService', 'workflowService', 'learnerService', 'forbiddenCrossOwnerWrites',
  ], 'ownership');
  const expectedOwners = {
    learningService: ['planning-input', 'learning-plan', 'today-stream', 'learning-task', 'lrn_srs_state', 'review-fact', 'repair-schedule', 'mastery-projection', 'learning-report-snapshot'],
    assessmentService: ['assessment-session', 'checkpoint', 'attempt', 'deterministic-outcome', 'semantic-error-mapping-input', 'assessment-report-snapshot'],
    contentService: ['published-content', 'learning-item', 'content-version', 'answer-rule', 'legal-variant', 'rights'],
    workflowService: ['retry', 'dlq', 'replay', 'saga', 'manual-recovery-task'],
    learnerService: ['profile', 'target', 'preferences', 'first-day-read-projection'],
    forbiddenCrossOwnerWrites: [
      'assessment-service->lrn_srs_state', 'assessment-service->mastery-projection', 'assessment-service->learning-report-snapshot',
      'learner-service->learning-plan', 'workflow-service->assessment-or-learning-schema', 'client->canonical-kafka-fact',
      'client->score-srs-mastery-xp-or-entitlement',
    ],
  };
  exact(errors, ownership, expectedOwners, 'learning-loop ownership partition');
}

function checkDailyPlan(policy, errors) {
  const plan = policy?.dailyPlan;
  exactKeys(errors, plan, [
    'algorithmVersion', 'legacyAlgorithmAliases', 'legacyAliasPolicy', 'dailyQuotaMinutes', 'planningRunInputRequiredFields',
    'planningRunForbiddenFields', 'priorityClasses', 'budgetLanes', 'candidateRequiredFields', 'candidateEligibility',
    'deduplication', 'stableSortTuple', 'normalBudgets', 'selectionPolicy', 'catchUp', 'reasonCodes', 'deferPolicy', 'planAndTask',
  ], 'daily plan');
  exact(errors, plan?.algorithmVersion, RULE_PACKAGES.dailyPlan, 'daily plan algorithm version');
  exact(errors, plan?.legacyAlgorithmAliases, ['P1_PLAN_V1'], 'daily plan legacy aliases');
  exact(errors, plan?.legacyAliasPolicy, 'READ_COMPATIBILITY_ONLY_NEVER_A_SECOND_ALGORITHM_VERSION', 'daily plan alias policy');
  exact(errors, plan?.dailyQuotaMinutes, DAILY_QUOTAS, 'daily plan quota options');
  exact(errors, plan?.priorityClasses, PRIORITY_CLASSES, 'daily plan priority classes');
  exact(errors, plan?.normalBudgets, NORMAL_BUDGETS, 'daily plan budget baselines');
  exact(errors, plan?.stableSortTuple, [
    { field: 'priorityClass.ordinal', direction: 'ASC' },
    { field: 'dueSortAt', direction: 'ASC', missingValue: '9999-12-31T23:59:59.999999999Z' },
    { field: 'riskScore', direction: 'DESC' },
    { field: 'goalAffinity', direction: 'DESC' },
    { field: 'lastEvidenceAt', direction: 'ASC', missingValue: '0001-01-01T00:00:00Z' },
    { field: 'stableCandidateId', direction: 'ASC', comparison: 'CANONICAL_ASCII_OR_UTF8_BINARY' },
  ], 'daily plan stable sort tuple');
  exact(errors, plan?.selectionPolicy?.totalCapFormula, 'CEILING(dailyQuotaMinutes * 1.10)', 'daily plan uplift formula');
  exact(errors, plan?.selectionPolicy?.overCapMandatoryPolicy, 'RETAIN_AS_OVERDUE_BACKLOG_WITHOUT_CHANGING_ORIGINAL_DUE_AT', 'daily plan over-cap mandatory policy');
  exact(errors, plan?.catchUp?.triggerFormula, 'debtMinutes > 2 * normalReviewRepairMinutes', 'catch-up trigger');
  exact(errors, plan?.catchUp?.catchUpDaysFormula, 'CLAMP(CEILING(debtMinutes / MAX(1, reviewCapMinutes)), 2, 7)', 'catch-up days formula');
  exact(errors, plan?.catchUp?.unresolvedDebtPolicy, 'RETURN_backlogRemainingAfterWindow_NEVER_FABRICATE_CLEARANCE', 'catch-up unresolved debt policy');
  add(errors, Array.isArray(plan?.reasonCodes) && plan.reasonCodes.length > 0 && new Set(plan.reasonCodes).size === plan.reasonCodes.length, 'daily plan learner-safe reason codes must be a non-empty unique list');
  add(errors, Array.isArray(plan?.planningRunForbiddenFields) && ['clientPlan', 'clientScore', 'clientMastery', 'clientDueAt', 'tenantId', 'ownerId', 'adultGate', 'consent', 'contentRights'].every((field) => plan.planningRunForbiddenFields.includes(field)), 'daily plan must reject client authority injection');
}

function checkSrs(policy, errors) {
  const srs = policy?.srs;
  exactKeys(errors, srs, [
    'algorithmVersion', 'numericArithmetic', 'roundingMode', 'rawQualityValues', 'objectiveOutcomes', 'qualityCaps', 'initialState',
    'objectiveOutcomeAuthority', 'stateValidation', 'formula', 'srsStages', 'stageDerivation', 'timePolicy', 'writeEntry', 'rejectConditions', 'legacyMigration',
  ], 'SRS');
  exact(errors, srs?.algorithmVersion, RULE_PACKAGES.srs, 'SRS algorithm version');
  exact(errors, srs?.numericArithmetic, 'DECIMAL_ONLY', 'SRS numeric arithmetic');
  exact(errors, srs?.roundingMode, 'ROUND_HALF_UP', 'SRS rounding mode');
  exact(errors, srs?.rawQualityValues, [0, 1, 2, 3], 'SRS raw quality domain');
  exact(errors, srs?.objectiveOutcomes, SRS_OBJECTIVE_OUTCOMES, 'SRS objective outcome domain');
  exact(errors, srs?.objectiveOutcomeAuthority, NO_OBJECTIVE_EXPECTED_AUTHORITY, 'SRS objective outcome authority');
  exact(errors, srs?.stateValidation, SRS_STATE_VALIDATION, 'SRS state validation');
  exact(errors, srs?.srsStages, SRS_STAGES, 'SRS stage values');
  exact(errors, srs?.formula?.easeFactorAfter, 'CLAMP(ROUND_HALF_UP(rawEaseFactor, 2), 1.30, 2.50)', 'SRS EF clamp formula');
  exact(errors, srs?.formula?.failedReviewCondition, 'effectiveQuality < 2', 'SRS failure threshold');
  exact(errors, srs?.formula?.successfulReview?.fixedIntervalsByRepetition, [1, 3, 7, 15, 30, 90], 'SRS fixed intervals');
  exact(errors, srs?.formula?.successfulReview?.postSixIntervalDays, 'CLAMP(ROUND_HALF_UP(intervalDays * easeFactorAfter, 0), 1, 365)', 'SRS post-six interval formula');
  exactKeys(errors, srs?.timePolicy, ['reviewedAtAuthority', 'timezoneAuthority', 'dueLocalFormula', 'dueAtFormula', 'dstGap', 'dstOverlap', 'timezoneChange', 'requiredAuditFields'], 'SRS time policy');
  exact(errors, srs?.timePolicy?.reviewedAtAuthority, 'SERVER_ACCEPTED_UTC_INSTANT', 'SRS reviewedAt authority');
  exact(errors, srs?.timePolicy?.timezoneAuthority, 'SERVER_DERIVED_IANA_TIMEZONE', 'SRS timezone authority');
  exact(errors, srs?.timePolicy?.dstGap, 'SHIFT_FORWARD_TO_FIRST_VALID_LOCAL_TIME', 'SRS DST gap policy');
  exact(errors, srs?.timePolicy?.dstOverlap, 'USE_EARLIER_OFFSET', 'SRS DST overlap policy');
  exact(errors, srs?.timePolicy?.timezoneChange, 'PRESERVE_EXISTING_dueAt_AND_USE_NEW_SERVER_DERIVED_TIMEZONE_FOR_FUTURE_ACCEPTED_REVIEWS', 'SRS timezone migration policy');
  exactKeys(errors, srs?.writeEntry, [
    'canonicalPublicOperationId', 'canonicalPublicPath', 'canonicalRequestRequiredFields', 'canonicalRequestForbiddenFields',
    'trustedOutcomeSource', 'singleTransitionService', 'earlyReviewDecision', 'sameReceiptSamePayload', 'sameReceiptDifferentPayload',
  ], 'SRS canonical write entry');
  exact(errors, srs?.writeEntry?.canonicalPublicOperationId, 'completeB10LearningReview', 'single SRS canonical operation');
  exact(errors, srs?.writeEntry?.canonicalPublicPath, '/api/v1/learning/review-queue/{queueItemId}/complete', 'single SRS canonical path');
  exact(errors, srs?.writeEntry?.canonicalRequestForbiddenFields, FORBIDDEN_CLIENT_AUTHORITY, 'SRS forbidden client authority fields');
  exact(errors, srs?.writeEntry?.earlyReviewDecision, 'CONFLICT_409', 'SRS early review policy');
  exact(errors, srs?.writeEntry?.sameReceiptSamePayload, 'REPLAY_ORIGINAL_RECEIPT', 'SRS same receipt replay');
  exact(errors, srs?.writeEntry?.sameReceiptDifferentPayload, 'CONFLICT_409', 'SRS same receipt conflict');
  exactKeys(errors, srs?.legacyMigration, ['legacyWriteOperations', 'legacyDisposition', 'adapterMayComputeAlgorithm', 'adapterMayWriteLrnSrsState', 'legacyBatchPolicy', 'unmappableLegacyQuality', 'cutoverDecision'], 'SRS legacy migration');
  exact(errors, srs?.legacyMigration?.legacyWriteOperations, ['submitReviewEvent', 'syncReviewEvents', 'B1_SRS_WRITE_IF_DISCOVERED'], 'SRS legacy writes');
  exact(errors, srs?.legacyMigration?.legacyDisposition, 'DEPRECATED_ADAPTER_ONLY', 'SRS legacy disposition');
  exact(errors, srs?.legacyMigration?.adapterMayComputeAlgorithm, false, 'SRS adapter algorithm authority');
  exact(errors, srs?.legacyMigration?.adapterMayWriteLrnSrsState, false, 'SRS adapter lrn_srs_state authority');
  exact(errors, srs?.legacyMigration?.legacyBatchPolicy, 'ORDERED_PER_EVENT_TRANSLATION_TO_SINGLE_TRANSITION_SERVICE', 'SRS legacy batch policy');
}

function checkRepair(policy, errors) {
  const repair = policy?.repair;
  exactKeys(errors, repair, ['ruleVersion', 'workflowStates', 'verificationStages', 'availabilityStates', 'semanticErrorCategories', 'transitionTable', 'variantPolicy', 'delayPolicy'], 'repair');
  exact(errors, repair?.ruleVersion, RULE_PACKAGES.repair, 'repair rule version');
  exact(errors, repair?.workflowStates, REPAIR_STATES, 'repair workflow states');
  exact(errors, repair?.transitionTable, [
    { from: 'ASSESSMENT_ERROR', to: 'REVIEW_QUEUE', trigger: 'TRUSTED_ASSESSMENT_ERROR' },
    { from: 'REVIEW_QUEUE', to: 'LEARNING', trigger: 'LEGAL_VARIANT_STARTED' },
    { from: 'LEARNING', to: 'DELAY_VERIFY_D1', trigger: 'IMMEDIATE_REPAIR_PASS' },
    { from: 'LEARNING', to: 'REVIEW_QUEUE', trigger: 'IMMEDIATE_REPAIR_FAIL' },
    { from: 'DELAY_VERIFY_D1', to: 'DELAY_VERIFY_D7', trigger: 'D1_PASS' },
    { from: 'DELAY_VERIFY_D1', to: 'REOPENED', trigger: 'D1_FAIL' },
    { from: 'DELAY_VERIFY_D7', to: 'MASTERED', trigger: 'D7_PASS_AND_MASTERY_GATE' },
    { from: 'DELAY_VERIFY_D7', to: 'REOPENED', trigger: 'D7_FAIL_OR_MASTERY_GATE_NOT_MET' },
    { from: 'REOPENED', to: 'REVIEW_QUEUE', trigger: 'REPAIR_REQUEUED' },
  ], 'repair transition table');
  exact(errors, repair?.variantPolicy?.allowedRelationships, ['LEGAL_VARIANT', 'CONTEXTUAL_EQUIVALENT'], 'repair legal variant relationships');
  exact(errors, repair?.variantPolicy?.originalQuestionPolicy, 'EXPLANATION_ONLY_NOT_SUFFICIENT_AS_THE_ONLY_REPAIR_EVIDENCE', 'repair original-question policy');
  exact(errors, repair?.delayPolicy?.d1Formula, 'FIRST_CONFIGURED_STUDY_DAY_STRICTLY_AFTER_IMMEDIATE_REPAIR_LOCAL_DATE', 'repair D1 formula');
  exact(errors, repair?.delayPolicy?.d7NominalFormula, 'D1_PASS_LOCAL_DATE_PLUS_7_CALENDAR_DAYS', 'repair D7 nominal formula');
  exact(errors, repair?.delayPolicy?.dueTimePolicy, 'PRESERVE_SOURCE_LOCAL_TIME_USING_SRS_DST_POLICY', 'repair DST policy');
}

function checkMastery(policy, errors) {
  const mastery = policy?.mastery;
  exactKeys(errors, mastery, ['ruleVersion', 'masteryStages', 'evidenceRequiredFields', 'evidenceScoreFormula', 'qualifyingEvidence', 'criticalError', 'aggregation', 'promotion', 'postD7GateFailure', 'contentVersionPolicy'], 'mastery');
  exact(errors, mastery?.ruleVersion, RULE_PACKAGES.mastery, 'mastery rule version');
  exact(errors, mastery?.masteryStages, MASTERY_STAGES, 'mastery stage values');
  add(errors, Array.isArray(mastery?.evidenceRequiredFields) && ['evidenceId', 'sourceEventId', 'attemptId', 'logicalItemId', 'contentVersionId', 'contentEpoch', 'objectiveCorrect', 'evidenceScore', 'effectiveQuality', 'guessSignal', 'ruleVersion', 'ruleDigest', 'occurredAt', 'localDate', 'evidenceDigest'].every((field) => mastery.evidenceRequiredFields.includes(field)), 'mastery evidence must be deduplicable and version pinned');
  exact(errors, mastery?.qualifyingEvidence?.oneEvidencePerLocalDate, 'LATEST_BY_occurredAt_THEN_evidenceId', 'mastery daily evidence dedupe');
  exact(errors, mastery?.qualifyingEvidence?.dedupeKey, 'evidenceId', 'mastery evidence dedupe key');
  exact(errors, mastery?.aggregation?.candidateEvidence, 'THREE_MOST_RECENT_DISTINCT_LOCAL_DATES_IN_CURRENT_EPOCH', 'mastery spaced evidence rule');
  exact(errors, mastery?.aggregation?.minimumEvidenceCount, 3, 'mastery minimum evidence count');
  exact(errors, mastery?.promotion?.mastered, 'D7_PASS_IN_CURRENT_EPOCH && qualifyingEvidenceCount >= 3 && aggregateScore >= 85', 'mastery 85 gate');
  exact(errors, mastery?.promotion?.consolidated, 'MASTERED && aggregateScore >= 95 && latestQualifyingEvidence.effectiveQuality == 3 && latestQualifyingEvidence.guessSignal == false', 'mastery 95 gate');
  exact(errors, mastery?.criticalError?.effect, 'START_NEW_MASTERY_EPOCH_AND_DOWNGRADE_TO_LEARNING', 'mastery critical-error effect');
}

function checkReport(policy, errors) {
  const report = policy?.report;
  exactKeys(errors, report, ['ruleVersion', 'reportKinds', 'snapshotStatuses', 'reportKeyFields', 'snapshotRequiredFields', 'requiredSourceOwners', 'missingWatermarkDecision', 'snapshotValidation', 'metricDefinitions', 'zeroDenominatorDecision', 'lateEvent'], 'report');
  exact(errors, report?.ruleVersion, RULE_PACKAGES.report, 'report rule version');
  exact(errors, report?.reportKinds, ['DAILY', 'WEEKLY', 'PHASE'], 'report kinds');
  exact(errors, report?.snapshotStatuses, ['PROCESSING', 'READY', 'PARTIAL', 'FAILED', 'NOT_APPLICABLE'], 'report statuses');
  add(errors, Array.isArray(report?.snapshotRequiredFields) && ['reportId', 'reportVersion', 'reportRuleVersion', 'asOf', 'window', 'sourceWatermarks', 'sourceWatermarkDigest', 'inputVersions', 'metricDefinitionsVersion', 'sourceFactDigest', 'status', 'metrics'].every((field) => report.snapshotRequiredFields.includes(field)), 'report snapshots must carry asOf, source watermarks, versions, metrics and source trace');
  exact(errors, report?.requiredSourceOwners, ['learning-service', 'assessment-service'], 'report source owners');
  exact(errors, report?.missingWatermarkDecision, 'PROCESSING_WITH_NULL_METRICS_NEVER_ZERO', 'missing report watermark policy');
  exact(errors, report?.snapshotValidation, REPORT_SNAPSHOT_VALIDATION, 'report snapshot validation');
  exact(errors, report?.zeroDenominatorDecision, 'NOT_APPLICABLE_WITH_NULL_VALUE', 'report zero denominator policy');
  exactKeys(errors, report?.lateEvent, ['windowAttribution', 'lateCondition', 'immutableSnapshotPolicy', 'rebuildPolicy', 'replayDeduplication', 'historicalRulePolicy', 'lateSnapshotRequiredFields'], 'report late event policy');
  exact(errors, report?.lateEvent?.immutableSnapshotPolicy, 'NEVER_MUTATE_EXISTING_REPORT_VERSION', 'report immutable snapshot policy');
  exact(errors, report?.lateEvent?.rebuildPolicy, 'CREATE_REPORT_VERSION_PLUS_ONE_WITH_supersedesReportVersion', 'report rebuild policy');
  exact(errors, report?.lateEvent?.replayDeduplication, 'SOURCE_EVENT_ID_OR_EVIDENCE_ID', 'report replay dedupe');
  exact(errors, report?.lateEvent?.lateSnapshotRequiredFields, ['supersedesReportVersion', 'lateSourceFactId', 'lateSourceWatermark'], 'report late snapshot lineage fields');
}

function checkOffline(policy, errors) {
  const offline = policy?.offlineAndIdempotency;
  exactKeys(errors, offline, ['requiredClientFields', 'serverDerivedFields', 'dedupeScope', 'commandFieldConstraints', 'replayPolicy', 'sameEventDifferentPayload', 'conflictPolicy', 'canonicalKafkaClientProduction'], 'offline and idempotency');
  exact(errors, offline?.requiredClientFields, REQUIRED_OFFLINE_FIELDS, 'offline required client fields');
  exact(errors, offline?.serverDerivedFields, ['tenant', 'principal', 'owner', 'objectiveOutcome', 'effectiveQuality', 'score', 'dueAt', 'srsStage', 'repairWorkflowState', 'masteryStage', 'xp', 'entitlement'], 'offline server-derived fields');
  exact(errors, offline?.dedupeScope, 'principalId + deviceRegistrationId + clientEventId', 'offline dedupe scope');
  exact(errors, offline?.commandFieldConstraints, OFFLINE_COMMAND_CONSTRAINTS, 'offline command field constraints');
  exact(errors, offline?.replayPolicy, OFFLINE_REPLAY_POLICY, 'offline replay policy');
  exact(errors, offline?.sameEventDifferentPayload, 'CONFLICT_409', 'offline payload collision policy');
  exact(errors, offline?.conflictPolicy, 'RETURN_CURRENT_SAFE_STATE_OR_RECOVERY_REFERENCE_NEVER_LAST_WRITE_WINS', 'offline conflict policy');
  exact(errors, offline?.canonicalKafkaClientProduction, 'PROHIBITED', 'client canonical Kafka policy');
}

function checkEvents(policy, errors) {
  const approved = policy?.compatibilityPromotion?.approvedCanonicalEvents;
  add(errors, Array.isArray(approved) && approved.length === APPROVED_CANONICAL_EVENTS.length, 'M1-013 approved canonical event inventory must contain exactly three events');
  exact(errors, approved, APPROVED_CANONICAL_EVENTS, 'M1-013 approved canonical events');
  const deferred = policy?.deferredEventCandidates;
  add(errors, Array.isArray(deferred) && deferred.length === DEFERRED_EVENT_CANDIDATES.length, 'M1-013 deferred event candidate inventory must contain exactly six events');
  exact(errors, deferred, DEFERRED_EVENT_CANDIDATES, 'M1-013 deferred event candidates');
}

function checkCanonicalRoutes(policy, input, errors) {
  const routes = policy?.compatibilityPromotion?.canonicalRoutes;
  const routeKeys = ['id', 'method', 'path', 'operationId', 'requestSchema', 'responseSchema', 'owner', 'requiredPermission', 'security', 'idempotency'];
  add(errors, Array.isArray(routes) && routes.length > 0, 'M1-013 must declare a non-empty exact canonical route inventory');
  add(errors, new Set((routes ?? []).map((route) => route?.id)).size === routes?.length, 'canonical route ids must be unique');
  add(errors, new Set((routes ?? []).map((route) => `${route?.method}:${route?.path}`)).size === routes?.length, 'canonical route method/path pairs must be unique');
  add(errors, new Set((routes ?? []).map((route) => route?.operationId)).size === routes?.length, 'canonical route operation ids must be unique');
  for (const route of routes ?? []) {
    exactKeys(errors, route, routeKeys, `canonical route ${route?.id ?? 'UNKNOWN'}`);
    add(errors, typeof route?.id === 'string' && /^B10-[A-Z0-9-]+$/.test(route.id), `canonical route ${route?.id ?? 'UNKNOWN'} id must be a stable B10 identifier`);
    add(errors, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(route?.method), `canonical route ${route?.id ?? 'UNKNOWN'} method is invalid`);
    add(errors, typeof route?.path === 'string' && route.path.startsWith('/api/v1/'), `canonical route ${route?.id ?? 'UNKNOWN'} must remain an external /api/v1 route`);
    add(errors, typeof route?.operationId === 'string' && route.operationId.length > 0, `canonical route ${route?.id ?? 'UNKNOWN'} operationId is required`);
    add(errors, route?.requestSchema === 'NONE' || (typeof route?.requestSchema === 'string' && /^B10[A-Za-z0-9]+$/.test(route.requestSchema)), `canonical route ${route?.id ?? 'UNKNOWN'} request schema is invalid`);
    add(errors, typeof route?.responseSchema === 'string' && /^B10[A-Za-z0-9]+(?:\[\])?$/.test(route.responseSchema), `canonical route ${route?.id ?? 'UNKNOWN'} response schema is invalid`);
    exact(errors, route?.owner, 'learning-service', `canonical route ${route?.id ?? 'UNKNOWN'} owner`);
    exact(errors, route?.security, 'bearerAuth', `canonical route ${route?.id ?? 'UNKNOWN'} security`);
    add(errors, ['REQUIRED', 'NOT_REQUIRED'].includes(route?.idempotency), `canonical route ${route?.id ?? 'UNKNOWN'} idempotency policy is invalid`);
    const operation = operationAt(input.b10OpenApi, route);
    add(errors, isRecord(operation), `canonical route ${route?.id ?? 'UNKNOWN'} must exist in B10 fragment`);
    exact(errors, operation?.operationId, route?.operationId, `canonical route ${route?.id ?? 'UNKNOWN'} operationId`);
    exact(errors, operation?.['x-contract']?.owner, route?.owner, `canonical route ${route?.id ?? 'UNKNOWN'} x-contract owner`);
    exact(errors, operation?.['x-contract']?.canonical, true, `canonical route ${route?.id ?? 'UNKNOWN'} canonical marker`);
    add(errors, requiredBearerSecurity(operation), `canonical route ${route?.id ?? 'UNKNOWN'} must use bearerAuth security`);
    exact(errors, operation?.['x-authorization']?.defaultDecision, 'DENY', `canonical route ${route?.id ?? 'UNKNOWN'} authorization default`);
    exact(errors, operation?.['x-authorization']?.requiredPermission, route?.requiredPermission, `canonical route ${route?.id ?? 'UNKNOWN'} authorization permission`);
    exact(errors, operation?.['x-authorization']?.pep, 'learning-service-local', `canonical route ${route?.id ?? 'UNKNOWN'} service-side PEP`);
    if (route?.requestSchema === 'NONE') {
      add(errors, !Object.hasOwn(operation ?? {}, 'requestBody'), `canonical route ${route?.id ?? 'UNKNOWN'} must not accept a request body`);
    } else {
      exact(errors, operation?.requestBody?.required, true, `canonical route ${route?.id ?? 'UNKNOWN'} request body requirement`);
      exact(errors, operation?.requestBody?.content?.['application/json']?.schema?.$ref, `#/components/schemas/${route?.requestSchema}`, `canonical route ${route?.id ?? 'UNKNOWN'} request schema ref`);
      const requestSchema = schemaByReference(input.b10OpenApi, `#/components/schemas/${route?.requestSchema}`);
      exact(errors, requestSchema?.additionalProperties, false, `canonical route ${route?.id ?? 'UNKNOWN'} request schema closure`);
    }
    const expectedResponseSchema = String(route?.responseSchema ?? '').replace(/\[\]$/, '');
    add(errors, containsReference(responseSchema(operation), `#/components/schemas/${expectedResponseSchema}`), `canonical route ${route?.id ?? 'UNKNOWN'} response must reference ${route?.responseSchema}`);
    if (route?.idempotency === 'REQUIRED') {
      exact(errors, operation?.['x-idempotency']?.required, true, `canonical route ${route?.id ?? 'UNKNOWN'} idempotency requirement`);
      exact(errors, operation?.['x-idempotency']?.keyHeader, 'Idempotency-Key', `canonical route ${route?.id ?? 'UNKNOWN'} idempotency key header`);
    } else {
      add(errors, operation?.['x-idempotency']?.required !== true, `canonical route ${route?.id ?? 'UNKNOWN'} must not claim required idempotency`);
    }
  }

  const actualCanonicalLearningRoutes = allOperations(input.b10OpenApi)
    .filter((entry) => entry.routePath.startsWith('/api/v1/learning/') && entry.operation?.['x-contract']?.canonical === true)
    .map((entry) => `${entry.method}:${entry.routePath}`)
    .sort();
  exact(errors, actualCanonicalLearningRoutes, (routes ?? []).map((route) => `${route.method}:${route.path}`).sort(), 'B10 canonical learning route projection');

  const canonicalSrs = (routes ?? []).filter((route) => route?.operationId === policy?.srs?.writeEntry?.canonicalPublicOperationId);
  add(errors, canonicalSrs.length === 1, 'there must be exactly one canonical public SRS write entrance');
}

function checkLegacyAdapters(policy, input, errors) {
  const adapters = policy?.compatibilityPromotion?.legacyAdapters;
  const adapterKeys = ['id', 'sourceFragment', 'method', 'path', 'operationId', 'canonicalOperationId', 'canonicalRoute', 'owner', 'requiredPermission', 'write'];
  add(errors, Array.isArray(adapters) && adapters.length > 0, 'M1-013 must declare exact B1/B2 legacy adapters');
  add(errors, new Set((adapters ?? []).map((adapter) => adapter?.id)).size === adapters?.length, 'legacy adapter ids must be unique');
  const routeByOperation = new Map((policy?.compatibilityPromotion?.canonicalRoutes ?? []).map((route) => [route.operationId, route]));
  for (const adapter of adapters ?? []) {
    exactKeys(errors, adapter, adapterKeys, `legacy adapter ${adapter?.id ?? 'UNKNOWN'}`);
    add(errors, typeof adapter?.id === 'string' && /^LEGACY-[A-Z0-9-]+$/.test(adapter.id), `legacy adapter ${adapter?.id ?? 'UNKNOWN'} id must be stable`);
    add(errors, [DEFAULT_B1_OPENAPI, DEFAULT_B2_COMPATIBILITY_OPENAPI, DEFAULT_B2_SRS_OPENAPI, DEFAULT_B2_MASTERY_OPENAPI].includes(adapter?.sourceFragment), `legacy adapter ${adapter?.id ?? 'UNKNOWN'} source fragment is unsupported`);
    const document = fragmentDocument(input, adapter?.sourceFragment);
    const operation = operationAt(document, adapter);
    const canonicalRoute = routeByOperation.get(adapter?.canonicalOperationId);
    add(errors, isRecord(operation), `legacy adapter ${adapter?.id ?? 'UNKNOWN'} must exist in its source fragment`);
    add(errors, isRecord(canonicalRoute), `legacy adapter ${adapter?.id ?? 'UNKNOWN'} must target an approved canonical operation`);
    exact(errors, operation?.operationId, adapter?.operationId, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} operationId`);
    exact(errors, operation?.deprecated, true, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} deprecation`);
    if (adapter?.operationId === 'getB2DailyStream') {
      // This adapter is owned by the earlier M1-010 compatibility chain. It
      // retains that documentation-only deprecation record; M1-013 freezes
      // its new target exclusively through the x-contract mapping below.
      exact(errors, operation?.['x-p1r-deprecation'], M1_010_DAILY_STREAM_DEPRECATION, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} M1-010 deprecation exception`);
    } else {
      exact(errors, operation?.['x-p1r-deprecation']?.canonicalOperationId, adapter?.canonicalOperationId, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} deprecation target`);
      const expectedMigrationLink = LEGACY_ROUTE_EXAMPLE_OPERATION_IDS.has(adapter?.operationId)
        ? operation?.['x-contract']?.canonicalRouteExample
        : adapter?.canonicalRoute;
      exact(errors, operation?.['x-p1r-deprecation']?.migrationLink, expectedMigrationLink, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} migration link`);
      if (LEGACY_ROUTE_EXAMPLE_OPERATION_IDS.has(adapter?.operationId)) {
        add(errors, typeof operation?.['x-contract']?.canonicalRouteExample === 'string' && operation['x-contract'].canonicalRouteExample.length > 0, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} must retain its concrete canonical route example`);
      }
    }
    exact(errors, operation?.['x-contract']?.owner, adapter?.owner, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} owner`);
    exact(errors, operation?.['x-contract']?.adapterOnly, true, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} adapter-only boundary`);
    exact(errors, operation?.['x-contract']?.canonicalOperationId, adapter?.canonicalOperationId, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} canonical operation`);
    exact(errors, operation?.['x-contract']?.canonicalRoute, adapter?.canonicalRoute, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} canonical route`);
    exact(errors, operation?.['x-contract']?.noIndependentCalculation, true, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} calculation boundary`);
    exact(errors, operation?.['x-contract']?.noDoubleWrite, true, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} double-write boundary`);
    add(errors, requiredBearerSecurity(operation), `legacy adapter ${adapter?.id ?? 'UNKNOWN'} must use bearerAuth security`);
    exact(errors, operation?.['x-authorization']?.defaultDecision, 'DENY', `legacy adapter ${adapter?.id ?? 'UNKNOWN'} authorization default`);
    exact(errors, operation?.['x-authorization']?.requiredPermission, adapter?.requiredPermission, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} required permission`);
    exact(errors, operation?.['x-authorization']?.serviceSidePepRequired, true, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} service-side PEP`);
    if (adapter?.write === true) exact(errors, operation?.['x-idempotency']?.required, true, `legacy adapter ${adapter?.id ?? 'UNKNOWN'} write idempotency`);
  }

  const declaredOperationKeys = new Set((adapters ?? []).map((adapter) => `${adapter.sourceFragment}:${adapter.operationId}`));
  const expectedOperationKeys = M1_013_LEGACY_OPERATION_SET.map(({ sourceFragment, operationId }) => `${sourceFragment}:${operationId}`);
  add(errors, (adapters ?? []).length === M1_013_LEGACY_OPERATION_SET.length, 'M1-013 policy must declare exactly the fixed 24 legacy adapters');
  exact(errors, [...declaredOperationKeys].sort(), [...expectedOperationKeys].sort(), 'M1-013 legacy adapter operation inventory');
  for (const { sourceFragment, operationId } of M1_013_LEGACY_OPERATION_SET) {
    const legacyRoute = routeOperation(fragmentDocument(input, sourceFragment), operationId);
    const declaredAdapter = (adapters ?? []).find((adapter) => adapter?.sourceFragment === sourceFragment && adapter?.operationId === operationId);
    add(errors, isRecord(legacyRoute?.operation), `M1-013 legacy adapter ${operationId} must remain discoverable until cutover`);
    exact(errors, legacyRoute?.operation?.['x-contract']?.adapterOnly, true, `M1-013 legacy adapter ${operationId} must remain adapter-only`);
    add(errors, isRecord(declaredAdapter), `M1-013 legacy adapter ${operationId} must be explicitly declared by the frozen policy`);
  }
  for (const operationId of ['submitReviewEvent', 'syncReviewEvents']) {
    const legacyRoute = routeOperation(input.b2SrsOpenApi, operationId);
    const declaredAdapter = (adapters ?? []).find((adapter) => adapter?.sourceFragment === DEFAULT_B2_SRS_OPENAPI && adapter?.operationId === operationId);
    add(errors, isRecord(legacyRoute?.operation), `legacy SRS write ${operationId} must remain discoverable until cutover`);
    add(errors, isRecord(declaredAdapter), `legacy SRS write ${operationId} must be an explicitly declared adapter to the single canonical transition`);
  }
}

function checkSingleSrsWriteBoundary(policy, input, errors) {
  const canonicalOperationId = policy?.srs?.writeEntry?.canonicalPublicOperationId;
  const possibleSrsWrites = [
    ...allOperations(input.b10OpenApi).map((entry) => ({ source: DEFAULT_B10_OPENAPI, ...entry })),
    ...allOperations(input.b1OpenApi).map((entry) => ({ source: DEFAULT_B1_OPENAPI, ...entry })),
    ...allOperations(input.b2CompatibilityOpenApi).map((entry) => ({ source: DEFAULT_B2_COMPATIBILITY_OPENAPI, ...entry })),
    ...allOperations(input.b2SrsOpenApi).map((entry) => ({ source: DEFAULT_B2_SRS_OPENAPI, ...entry })),
    ...allOperations(input.b2MasteryOpenApi).map((entry) => ({ source: DEFAULT_B2_MASTERY_OPENAPI, ...entry })),
  ].filter((entry) => ['POST', 'PUT', 'PATCH'].includes(entry.method))
    .filter((entry) => entry.operation?.operationId === canonicalOperationId
      || entry.operation?.operationId === 'submitReviewEvent'
      || entry.operation?.operationId === 'syncReviewEvents'
      || String(entry.operation?.['x-contract']?.command ?? '').includes('srs'));
  const canonicalWrites = possibleSrsWrites.filter((entry) => entry.operation?.operationId === canonicalOperationId && entry.operation?.['x-contract']?.canonical === true);
  add(errors, canonicalWrites.length === 1 && canonicalWrites[0]?.source === DEFAULT_B10_OPENAPI, 'only the B10 canonical route may be a canonical SRS write entrance');
  for (const entry of possibleSrsWrites) {
    if (entry.operation?.operationId === canonicalOperationId && entry.source === DEFAULT_B10_OPENAPI) continue;
    exact(errors, entry.operation?.['x-contract']?.adapterOnly, true, `non-canonical SRS write ${entry.operation?.operationId} must be adapter-only`);
    exact(errors, entry.operation?.['x-contract']?.noIndependentCalculation, true, `non-canonical SRS write ${entry.operation?.operationId} must not calculate SM2`);
    exact(errors, entry.operation?.['x-contract']?.noDoubleWrite, true, `non-canonical SRS write ${entry.operation?.operationId} must not double-write lrn_srs_state`);
  }
}

function checkThreeStateSchemas(input, errors) {
  for (const schemaName of ['B10LearningQueueItem', 'B10MasteryProjection']) {
    const schema = input.b10OpenApi?.components?.schemas?.[schemaName];
    add(errors, isRecord(schema), `${schemaName} must exist as a public state projection schema`);
    exact(errors, schema?.additionalProperties, false, `${schemaName} must be closed`);
    add(errors, ['srsStage', 'repairWorkflowState', 'masteryStage'].every((field) => schema?.required?.includes(field) && Object.hasOwn(schema?.properties ?? {}, field)), `${schemaName} must require independent SRS, repair and mastery fields`);
    exact(errors, schema?.properties?.srsStage?.enum, SRS_STAGES, `${schemaName} SRS stage domain`);
    exact(errors, schema?.properties?.repairWorkflowState?.enum, REPAIR_STATES, `${schemaName} repair workflow domain`);
    exact(errors, schema?.properties?.masteryStage?.enum, MASTERY_STAGES, `${schemaName} mastery stage domain`);
  }
}

function checkSrsRequestAuthority(policy, input, errors) {
  const route = operationAt(input.b10OpenApi, {
    method: 'POST',
    path: policy?.srs?.writeEntry?.canonicalPublicPath,
  });
  const reference = route?.requestBody?.content?.['application/json']?.schema?.$ref;
  const schema = schemaByReference(input.b10OpenApi, reference);
  add(errors, isRecord(schema), 'canonical SRS write request schema must resolve locally');
  exact(errors, schema?.additionalProperties, false, 'canonical SRS write request schema must be closed');
  const requiredFields = policy?.srs?.writeEntry?.canonicalRequestRequiredFields ?? [];
  add(errors, requiredFields.every((field) => schema?.required?.includes(field) && Object.hasOwn(schema?.properties ?? {}, field)), 'canonical SRS write request must contain all frozen concurrency, idempotency and pin fields');
  const forbiddenFields = policy?.srs?.writeEntry?.canonicalRequestForbiddenFields ?? [];
  add(errors, forbiddenFields.every((field) => !Object.hasOwn(schema?.properties ?? {}, field)), 'canonical SRS write request must reject all server-owned authority fields');
  add(errors, forbiddenFields.every((field) => schema?.['x-forbidden-client-fields']?.includes(field)), 'canonical SRS write request must publish every authority rejection in x-forbidden-client-fields');
}

function firstDayProjectionVariant(document, state) {
  const projection = document?.components?.schemas?.[FIRST_DAY_PROJECTION_CONTRACT.responseSchema];
  const variants = (projection?.allOf ?? []).flatMap((part) => part?.oneOf ?? []);
  return variants.find((variant) => variant?.properties?.state?.const === state);
}

function checkFirstDayProjectionBoundary(input, errors) {
  const document = input.b9FirstDayOpenApi;
  const route = routeOperation(document, FIRST_DAY_PROJECTION_CONTRACT.operationId);
  const projection = document?.components?.schemas?.[FIRST_DAY_PROJECTION_CONTRACT.responseSchema];
  const common = document?.components?.schemas?.B9FirstDayProjectionCommon;
  const ready = firstDayProjectionVariant(document, 'READY');
  const degraded = firstDayProjectionVariant(document, 'DEGRADED');

  add(errors, isRecord(route?.operation), 'first-day projection canonical operation must exist');
  add(errors, requiredBearerSecurity(route?.operation), 'first-day projection canonical operation must use bearerAuth security');
  exact(errors, route?.operation?.['x-contract']?.owner, 'learner-service', 'first-day projection owner');
  exact(errors, route?.operation?.['x-authorization']?.defaultDecision, 'DENY', 'first-day projection authorization default');
  exact(errors, route?.operation?.['x-authorization']?.requiredPermission, 'learner.first-day.read', 'first-day projection required permission');
  exact(errors, route?.operation?.['x-authorization']?.pep, 'learner-service-local', 'first-day projection service-side PEP');
  add(errors, containsReference(responseSchema(route?.operation), `#/components/schemas/${FIRST_DAY_PROJECTION_CONTRACT.responseSchema}`), 'first-day projection response must reference B9FirstDayProjection');
  add(errors, isRecord(projection), 'B9FirstDayProjection schema must exist');
  add(errors, isRecord(common), 'B9FirstDayProjectionCommon schema must exist');
  exact(errors, common?.additionalProperties, false, 'B9FirstDayProjectionCommon must be closed');
  add(errors, isRecord(ready), 'B9FirstDayProjection must define a READY branch');
  exact(errors, ready?.properties?.taskCount?.minimum, FIRST_DAY_PROJECTION_CONTRACT.ready.taskCountMinimum, 'first-day READY taskCount lower bound');
  exact(errors, ready?.properties?.tasks?.minItems, FIRST_DAY_PROJECTION_CONTRACT.ready.tasksMinItems, 'first-day READY tasks minItems lower bound');
  add(errors, ready?.required?.includes('tasks'), 'first-day READY must require tasks');
  add(errors, isRecord(degraded), 'B9FirstDayProjection must define a DEGRADED branch');
  add(errors, degraded?.required?.includes(FIRST_DAY_PROJECTION_CONTRACT.degraded.reasonField), 'first-day DEGRADED must require the frozen degradedReason field');
  add(errors, Object.hasOwn(degraded?.properties ?? {}, FIRST_DAY_PROJECTION_CONTRACT.degraded.reasonField), 'first-day DEGRADED must expose the frozen degradedReason field');
  add(errors, Object.hasOwn(common?.properties ?? {}, FIRST_DAY_PROJECTION_CONTRACT.degraded.reasonField), 'first-day projection common schema must preserve degradedReason');
}

function generatedRegistryEntry(route) {
  return `${route.operationId}: { method: "${route.method}"; path: "${route.path}";`;
}

function generatedTypeExists(text, typeName) {
  return text.includes(`export type ${typeName} =`) || text.includes(`export interface ${typeName} `);
}

function checkGeneratedTypeProjection(policy, input, errors) {
  const generatedOpenApi = input.generatedOpenApi;
  const generatedEvents = input.generatedEvents;
  const generatedIndex = input.generatedIndex;
  const generatedSchemas = input.generatedSchemas;
  const generatedApiClient = input.generatedApiClient;
  for (const [text, label] of [
    [generatedOpenApi, 'generated OpenAPI TypeScript'], [generatedEvents, 'generated event TypeScript'],
    [generatedIndex, 'generated contract TypeScript barrel'], [generatedSchemas, 'generated schema utility TypeScript'],
    [generatedApiClient, 'generated API client TypeScript'],
  ]) add(errors, typeof text === 'string' && text.length > 0, `${label} must exist; static source contracts are not a generated-type promotion substitute`);
  if (![generatedOpenApi, generatedEvents, generatedIndex, generatedSchemas, generatedApiClient].every((text) => typeof text === 'string' && text.length > 0)) return;

  add(errors, generatedOpenApi.includes('GENERATED FILE'), 'generated OpenAPI TypeScript must retain generated provenance');
  add(errors, generatedEvents.includes('GENERATED FILE'), 'generated event TypeScript must retain generated provenance');
  add(errors, generatedSchemas.includes('GENERATED FILE'), 'generated schema utility TypeScript must retain generated provenance');
  add(errors, generatedIndex.includes("export * from './openapi';") && generatedIndex.includes("export * from './events';") && generatedIndex.includes("export * from './schemas';"), 'generated contract barrel must export OpenAPI, event and schema artifacts');
  for (const route of policy?.compatibilityPromotion?.canonicalRoutes ?? []) {
    const entry = generatedRegistryEntry(route);
    add(errors, generatedOpenApi.includes(entry), `generated OpenAPI registry must contain ${route?.operationId} with the frozen method/path`);
    add(errors, generatedApiClient.includes(entry), `generated API client registry must contain ${route?.operationId} with the frozen method/path`);
    if (route?.requestSchema !== 'NONE') add(errors, generatedTypeExists(generatedOpenApi, route?.requestSchema), `generated OpenAPI TypeScript must contain request type ${route?.requestSchema}`);
    const responseSchema = String(route?.responseSchema ?? '').replace(/\[\]$/, '');
    add(errors, generatedTypeExists(generatedOpenApi, responseSchema), `generated OpenAPI TypeScript must contain response type ${route?.responseSchema}`);
  }
  add(errors, generatedTypeExists(generatedOpenApi, FIRST_DAY_PROJECTION_CONTRACT.responseSchema), 'generated OpenAPI TypeScript must contain B9FirstDayProjection');
  add(errors, generatedOpenApi.includes(generatedRegistryEntry({
    operationId: FIRST_DAY_PROJECTION_CONTRACT.operationId,
    method: 'GET',
    path: '/api/v1/learner/first-day',
  })), 'generated OpenAPI registry must contain the first-day projection operation');
  add(errors, generatedApiClient.includes(generatedRegistryEntry({
    operationId: FIRST_DAY_PROJECTION_CONTRACT.operationId,
    method: 'GET',
    path: '/api/v1/learner/first-day',
  })), 'generated API client registry must contain the first-day projection operation');
  for (const event of APPROVED_CANONICAL_EVENTS) {
    const payloadType = event.payloadRef.slice('#/payloadSchemas/'.length);
    add(errors, generatedTypeExists(generatedEvents, payloadType), `generated event TypeScript must contain payload type ${payloadType}`);
    add(errors, generatedEvents.includes(`eventName: "${event.eventName}";`), `generated event TypeScript must contain canonical event ${event.eventName}`);
    add(errors, generatedEvents.includes(`"payloadRef": "${event.payloadRef}"`), `generated event TypeScript must preserve canonical payload reference ${event.payloadRef}`);
  }
}

function checkAdversarialCases(policy, errors) {
  const cases = policy?.adversarialCases;
  add(errors, Array.isArray(cases) && cases.length >= 50, 'M1-013 requires at least fifty adversarial cases');
  add(errors, new Set(cases ?? []).size === cases?.length, 'M1-013 adversarial case ids must be unique');
  const required = [
    'PLAN_TOTAL_CAP_10_PERCENT_BOUNDARY', 'PLAN_CATCH_UP_GREATER_THAN_TWO_R0_TRIGGERED',
    'SRS_DECIMAL_HALF_UP_EASE_FACTOR', 'SRS_DST_GAP_AND_OVERLAP', 'SRS_CLIENT_SEQUENCE_OUT_OF_ORDER',
    'REPAIR_D7_GATE_NOT_MET_REOPENS', 'MASTERY_SAME_LOCAL_DATE_DOES_NOT_COUNT_THREE_TIMES',
    'REPORT_MISSING_WATERMARK_PROCESSING', 'REPORT_LATE_EVENT_CREATES_NEW_VERSION',
    'SRS_UNKNOWN_OBJECTIVE_OUTCOME_REJECTED', 'SRS_NO_OBJECTIVE_EXPECTED_REQUIRES_SERVER_PREDECLARED_PRACTICE',
    'SRS_NO_OBJECTIVE_EXPECTED_ILLEGAL_PRACTICE_REJECTED', 'SRS_STATE_NEGATIVE_OR_FRACTIONAL_REJECTED',
    'SRS_DECIMAL_1_005_HALF_UP', 'OFFLINE_REPLAY_SAME_PAYLOAD_RETURNS_ORIGINAL_RECEIPT',
    'OFFLINE_CLIENT_SEQ_OUT_OF_ORDER_REJECTED', 'OFFLINE_SAME_EVENT_DIFFERENT_PAYLOAD_CONFLICT',
    'REPORT_METRIC_ARBITRARY_VALUE_REJECTED', 'REPORT_NEGATIVE_DENOMINATOR_REJECTED',
    'CLIENT_CANONICAL_EVENT_OR_MASTERY_XP_AUTHORITY_REJECTED',
  ];
  add(errors, required.every((caseId) => cases?.includes(caseId)), 'M1-013 adversarial matrix is missing a required failure-closed case');
}

function checkPolicy(policy, errors, frozenPolicyDigest) {
  exactPolicyRoot(policy, errors, frozenPolicyDigest);
  checkCompatibilityPromotion(policy, errors);
  checkFirstDayProjectionPolicy(policy, errors);
  checkRuntimeBoundary(policy, errors);
  exact(errors, policy?.rulePackages, RULE_PACKAGES, 'rule package inventory');
  checkOwnership(policy, errors);
  checkDailyPlan(policy, errors);
  checkSrs(policy, errors);
  checkRepair(policy, errors);
  checkMastery(policy, errors);
  checkReport(policy, errors);
  checkOffline(policy, errors);
  checkEvents(policy, errors);
  checkAdversarialCases(policy, errors);
}

function checkObjectivePolicyPinSchema(payload, errors) {
  const pin = payload?.properties?.objectivePolicyPin;
  exactKeys(errors, pin, ['type', 'additionalProperties', 'description', 'required', 'properties'], 'assessment objectivePolicyPin schema');
  exact(errors, pin?.type, 'object', 'assessment objectivePolicyPin type');
  exact(errors, pin?.additionalProperties, false, 'assessment objectivePolicyPin closure');
  exact(errors, pin?.description, ASSESSMENT_OBJECTIVE_POLICY_PIN_DESCRIPTION, 'assessment objectivePolicyPin server authority description');
  exact(errors, pin?.required, ['practiceType', 'objectiveExpected', 'policyVersion', 'policyDigest'], 'assessment objectivePolicyPin required fields');
  exact(errors, Object.keys(pin?.properties ?? {}).sort(), ['objectiveExpected', 'policyDigest', 'policyVersion', 'practiceType'], 'assessment objectivePolicyPin property inventory');
  exact(errors, pin?.properties?.practiceType, {
    type: 'string', enum: ['OBJECTIVE_ASSESSMENT', 'SPEAKING_SELF_RATING', 'WRITING_SELF_RATING', 'ACTIVE_RECALL_SELF_RATING'],
  }, 'assessment objectivePolicyPin practiceType domain');
  exact(errors, pin?.properties?.objectiveExpected, { type: 'boolean' }, 'assessment objectivePolicyPin objectiveExpected type');
  exact(errors, pin?.properties?.policyVersion, { type: 'string', minLength: 1, maxLength: 96 }, 'assessment objectivePolicyPin policyVersion');
  exact(errors, pin?.properties?.policyDigest, { type: 'string', pattern: '^[A-Fa-f0-9]{64}$' }, 'assessment objectivePolicyPin policyDigest');
}

/*
 * JSON Schema does not execute these rules here.  The checker only verifies
 * that the public event fragment encodes the frozen branches/invariants; it
 * intentionally makes no assertion that a broker, consumer or runtime schema
 * validator has executed them.
 */
function checkLearningLoopEventCrossFieldRules(input, errors) {
  const schemas = input?.b10LearningLoopEventFragment?.payloadSchemas;
  const assessment = schemas?.B10AssessmentItemAssessedV2;
  const mastery = schemas?.B10LearningMasteryProjectedV2;
  const review = schemas?.B10LearningReviewScheduledV2;

  exact(errors, assessment?.['x-p1r-cross-field-invariants'], ASSESSMENT_CROSS_FIELD_INVARIANTS, 'assessment event cross-field invariants');
  checkObjectivePolicyPinSchema(assessment, errors);
  exact(errors, assessment?.oneOf, ASSESSMENT_OBJECTIVE_OUTCOME_BRANCHES, 'assessment event objective outcome branches');

  exact(errors, mastery?.['x-p1r-cross-field-invariants'], MASTERY_CROSS_FIELD_INVARIANTS, 'mastery event cross-field invariants');
  exact(errors, mastery?.oneOf, MASTERY_CROSS_FIELD_BRANCHES, 'mastery event stage branches');
  exact(errors, mastery?.allOf, [{ oneOf: MASTERY_EVIDENCE_COUNT_BRANCHES }], 'mastery event evidence-count/date branches');
  exact(errors, mastery?.properties?.evidenceLocalDates?.uniqueItems, true, 'mastery event evidence local dates uniqueness');
  exact(errors, mastery?.properties?.d7Gate?.oneOf, MASTERY_D7_GATE_BRANCHES, 'mastery event D7 gate branches');

  exact(errors, review?.['x-p1r-cross-field-invariants'], REVIEW_CROSS_FIELD_INVARIANTS, 'review event cross-field invariants');
  exact(errors, review?.oneOf, REVIEW_CROSS_FIELD_BRANCHES, 'review event repair-state branches');
  exact(errors, review?.properties?.reasonCodes?.uniqueItems, true, 'review event reasonCodes uniqueness');
}

function revalidateM1014CurrentSourceConsumers(input, errors) {
  const sourcePolicy = input?.m1014CurrentSourcePolicy;
  const revalidatedConsumers = new Map();
  if (!isRecord(sourcePolicy)) {
    add(errors, false, 'M1-014 current-source policy must be an object');
    return revalidatedConsumers;
  }

  const expectedSource = M1_014_CURRENT_SOURCE_REVALIDATION;
  const expectedPolicy = expectedSource.policy;
  const promotion = sourcePolicy.compatibilityPromotion;
  let valid = true;
  const check = (actual, expected, label) => {
    valid = exactPinnedCurrentSource(errors, actual, expected, label) && valid;
  };

  check(stableJsonDigest(sourcePolicy), expectedSource.policyDigest, 'M1-014 current-source policy digest');
  check(sourcePolicy.$schema, expectedPolicy.$schema, 'M1-014 current-source schema');
  check(sourcePolicy.schemaVersion, expectedPolicy.schemaVersion, 'M1-014 current-source schema version');
  check(sourcePolicy.task, expectedPolicy.task, 'M1-014 current-source task');
  check(sourcePolicy.phase, expectedPolicy.phase, 'M1-014 current-source phase');
  check(sourcePolicy.sourceBaseline, expectedPolicy.sourceBaseline, 'M1-014 current-source baseline');
  check(sourcePolicy.maturity, expectedPolicy.maturity, 'M1-014 current-source maturity');
  check(sourcePolicy.runtimeStatus, expectedPolicy.runtimeStatus, 'M1-014 current-source runtime status');
  check(promotion?.id, expectedPolicy.promotion.id, 'M1-014 current-source promotion id');
  check(promotion?.sourceContractBaseline, expectedPolicy.promotion.sourceContractBaseline, 'M1-014 current-source promotion baseline');
  check(promotion?.previousPromotion, expectedPolicy.promotion.previousPromotion, 'M1-014 current-source predecessor');
  check(promotion?.immutableGovernanceBaseline, expectedPolicy.promotion.immutableGovernanceBaseline, 'M1-014 current-source immutable governance baseline');
  check(promotion?.runtimeStatus, expectedPolicy.promotion.runtimeStatus, 'M1-014 current-source promotion runtime status');
  check(promotion?.scope, expectedPolicy.promotion.scope, 'M1-014 current-source promotion scope');
  check(sourcePolicy.runtimeBoundary?.contractOnly, expectedPolicy.runtimeBoundary.contractOnly, 'M1-014 current-source contract-only boundary');
  check(sourcePolicy.runtimeBoundary?.runtimeEvidence, expectedPolicy.runtimeBoundary.runtimeEvidence, 'M1-014 current-source runtime evidence');

  const sourceEvents = Array.isArray(promotion?.approvedCanonicalEvents) ? promotion.approvedCanonicalEvents : [];
  check(sourceEvents.length, 10, 'M1-014 current-source canonical event count');
  for (const expectedEvent of expectedSource.events) {
    const frozenEvent = APPROVED_CANONICAL_EVENTS.find((event) => event.eventName === expectedEvent.eventName);
    const currentEvents = sourceEvents.filter((event) => event?.eventName === expectedEvent.eventName);
    check(currentEvents.length, 1, `${expectedEvent.eventName} M1-014 current-source event count`);
    const currentEvent = currentEvents[0];
    check(currentEvent?.payloadRef, frozenEvent?.payloadRef, `${expectedEvent.eventName} M1-014 current-source payload ref`);
    check(currentEvent?.producer, frozenEvent?.producer, `${expectedEvent.eventName} M1-014 current-source producer`);
    check(currentEvent?.topic, frozenEvent?.topic, `${expectedEvent.eventName} M1-014 current-source topic`);
    check(currentEvent?.aggregateType, frozenEvent?.aggregateType, `${expectedEvent.eventName} M1-014 current-source aggregate type`);
    check(currentEvent?.aggregateIdField, frozenEvent?.aggregateIdField, `${expectedEvent.eventName} M1-014 current-source aggregate id field`);
    check(currentEvent?.requiredPayloadFields, frozenEvent?.requiredPayloadFields, `${expectedEvent.eventName} M1-014 current-source payload fields`);
    check(currentEvent?.status, 'CANONICAL_D2', `${expectedEvent.eventName} M1-014 current-source status`);
    check(currentEvent?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', `${expectedEvent.eventName} M1-014 current-source runtime status`);
    check(currentEvent?.consumers, expectedEvent.consumers, `${expectedEvent.eventName} M1-014 current-source consumers`);
  }

  if (valid) {
    for (const expectedEvent of expectedSource.events) {
      revalidatedConsumers.set(expectedEvent.eventName, expectedEvent.consumers);
    }
  }
  return revalidatedConsumers;
}

function checkSourceArtifacts(input, errors) {
  const {
    policy, b10OpenApi, b1OpenApi, b9FirstDayOpenApi, b2CompatibilityOpenApi, b2SrsOpenApi, b2MasteryOpenApi, b10EventFragment, b10LearningLoopEventFragment,
    b2SrsEventFragment, b2MasteryEventFragment, m1014CurrentSourcePolicy, catalog, b26Runtime, generatedOpenApi, generatedEvents, generatedIndex, generatedSchemas, generatedApiClient,
  } = input;
  for (const [value, label] of [
    [b10OpenApi, 'B10 learning/assessment fragment'], [b1OpenApi, 'B1 onboarding fragment'], [b9FirstDayOpenApi, 'B9 first-day projection fragment'], [b2CompatibilityOpenApi, 'B2 compatibility fragment'], [b2SrsOpenApi, 'B2 SRS fragment'],
    [b2MasteryOpenApi, 'B2 mastery fragment'], [b10EventFragment, 'B10 historical event fragment'],
    [b10LearningLoopEventFragment, 'B10 learning-loop event fragment'],
    [b2SrsEventFragment, 'B2 SRS historical event fragment'], [b2MasteryEventFragment, 'B2 mastery historical event fragment'],
    [m1014CurrentSourcePolicy, 'M1-014 current-source policy'],
    [catalog, 'event catalog'], [b26Runtime, 'B26 static runtime policy'],
  ]) add(errors, isRecord(value), `${label} must be an object`);
  if (![b10OpenApi, b1OpenApi, b9FirstDayOpenApi, b2CompatibilityOpenApi, b2SrsOpenApi, b2MasteryOpenApi, b10EventFragment, b10LearningLoopEventFragment, b2SrsEventFragment, b2MasteryEventFragment, m1014CurrentSourcePolicy, catalog, b26Runtime].every(isRecord)) return;

  checkCanonicalRoutes(policy, input, errors);
  checkLegacyAdapters(policy, input, errors);
  checkSingleSrsWriteBoundary(policy, input, errors);
  checkThreeStateSchemas(input, errors);
  checkSrsRequestAuthority(policy, input, errors);
  checkFirstDayProjectionBoundary(input, errors);
  checkGeneratedTypeProjection(policy, input, errors);
  checkLearningLoopEventCrossFieldRules(input, errors);
  const m1014RevalidatedConsumers = revalidateM1014CurrentSourceConsumers(input, errors);

  const canonicalOperation = policy?.srs?.writeEntry?.canonicalPublicOperationId;
  add(errors, !routeOperation(b2SrsOpenApi, canonicalOperation), 'legacy B2 SRS fragment must not impersonate the future single canonical SRS operation');
  for (const legacyOperationId of ['submitReviewEvent', 'syncReviewEvents']) {
    const operation = routeOperation(b2SrsOpenApi, legacyOperationId);
    add(errors, isRecord(operation?.operation), `B2 legacy SRS operation ${legacyOperationId} must remain discoverable for adapter inventory`);
    add(errors, !hasCanonicalClaim(operation?.operation), `B2 legacy SRS operation ${legacyOperationId} must not claim canonical/runtime promotion in rule-model track`);
  }
  for (const legacyOperationId of ['getB2DailyStream', 'getB2DailyReport', 'getB2WeeklyReport']) {
    const operation = routeOperation(b2MasteryOpenApi, legacyOperationId);
    add(errors, isRecord(operation?.operation), `B2 legacy operation ${legacyOperationId} must remain discoverable for adapter inventory`);
    add(errors, !hasCanonicalClaim(operation?.operation), `B2 legacy operation ${legacyOperationId} must not claim canonical/runtime promotion in rule-model track`);
  }

  const legacyEvents = [
    'assessment.attempt.assessed.v1', 'learning.mastery.projected.v1', 'learning.review.scheduled.v1',
    'vocabulary.review.accepted.v1', 'vocabulary.srs.state_changed.v1',
    'mastery.verification_state_changed.v1', 'report.generated.v1',
  ];
  for (const eventName of legacyEvents) {
    const event = eventEntry(catalog, eventName);
    add(errors, isRecord(event), `historical event ${eventName} must remain present in catalog during rule-model track`);
    add(errors, event?.status !== 'CANONICAL_D2' && event?.['x-p1r-governance']?.status !== 'CANONICAL_D2', `historical event ${eventName} must not be promoted canonical in rule-model track`);
    add(errors, !b26Route(b26Runtime, eventName), `historical event ${eventName} must not receive a B26 canonical route in rule-model track`);
  }
  for (const { eventName } of DEFERRED_EVENT_CANDIDATES) {
    add(errors, !eventEntry(catalog, eventName), `future event ${eventName} must not be silently promoted in rule-model-only track`);
    add(errors, !b26Route(b26Runtime, eventName), `future event ${eventName} must not receive B26 routing before exact promotion`);
  }
  for (const expected of APPROVED_CANONICAL_EVENTS) {
    const fragmentEvent = eventEntry(b10LearningLoopEventFragment, expected.eventName);
    const catalogEvent = eventEntry(catalog, expected.eventName);
    const route = b26Route(b26Runtime, expected.eventName);
    add(errors, isRecord(fragmentEvent), `approved canonical event ${expected.eventName} must exist in the B10 event fragment`);
    add(errors, isRecord(catalogEvent), `approved canonical event ${expected.eventName} must exist in the event catalog`);
    add(errors, isRecord(route), `approved canonical event ${expected.eventName} must have an exact B26 route`);
    exact(errors, fragmentEvent?.payloadSchema?.$ref, expected.payloadRef, `${expected.eventName} fragment payload ref`);
    exact(errors, catalogEvent?.payloadSchema?.$ref, expected.payloadRef, `${expected.eventName} catalog payload ref`);
    exact(errors, fragmentEvent?.aggregateIdField, expected.aggregateIdField, `${expected.eventName} fragment aggregate id field`);
    exact(errors, catalogEvent?.aggregateIdField, expected.aggregateIdField, `${expected.eventName} catalog aggregate id field`);
    exact(errors, fragmentEvent?.aggregateType, expected.aggregateType, `${expected.eventName} fragment aggregate type`);
    exact(errors, catalogEvent?.aggregateType, expected.aggregateType, `${expected.eventName} catalog aggregate type`);
    const payloadName = expected.payloadRef.slice('#/payloadSchemas/'.length);
    const payload = b10LearningLoopEventFragment?.payloadSchemas?.[payloadName];
    const catalogPayload = catalog?.payloadSchemas?.[payloadName];
    add(errors, isRecord(payload), `${expected.eventName} fragment payload schema must exist`);
    add(errors, isRecord(catalogPayload), `${expected.eventName} catalog payload schema must exist`);
    exact(errors, payload?.additionalProperties, false, `${expected.eventName} payload must be closed`);
    exact(errors, payload?.required, expected.requiredPayloadFields, `${expected.eventName} payload required fields`);
    exact(errors, Object.keys(payload?.properties ?? {}), expected.requiredPayloadFields, `${expected.eventName} payload properties`);
    exact(errors, catalogPayload, payload, `${expected.eventName} catalog payload projection`);
    add(errors, !['answer', 'answers', 'answerKey', 'rawAnswer', 'rawResponse', 'recording', 'recordingUrl', 'password', 'secret', 'token', 'authorization', 'cookie'].some((field) => Object.hasOwn(payload?.properties ?? {}, field)), `${expected.eventName} payload must not leak raw answers, media, credentials or authority`);
    exact(errors, catalogEvent?.status, 'CANONICAL_D2', `${expected.eventName} catalog status`);
    const governance = catalogEvent?.['x-p1r-governance'];
    exact(errors, governance?.status, 'CANONICAL_D2', `${expected.eventName} governance status`);
    exact(errors, governance?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', `${expected.eventName} governance runtime boundary`);
    exact(errors, governance?.scope, 'CROSS_SERVICE_INTEGRATION_FACT', `${expected.eventName} governance scope`);
    exact(errors, governance?.producer?.service, expected.producer, `${expected.eventName} producer`);
    exact(errors, governance?.producer?.dataOwner, expected.producer, `${expected.eventName} producer data owner`);
    exact(errors, governance?.producer?.outboxRequired, true, `${expected.eventName} outbox requirement`);
    exact(errors, governance?.transport?.topic, expected.topic, `${expected.eventName} governance topic`);
    exact(errors, governance?.transport?.partitionKey, 'aggregateId', `${expected.eventName} governance partition key`);
    exact(errors, governance?.transport?.aggregateIdSource, `payload.${expected.aggregateIdField}`, `${expected.eventName} governance aggregate source`);
    exact(errors, governance?.transport?.delivery, 'at-least-once', `${expected.eventName} governance delivery`);
    exact(errors, governance?.schema?.payloadRef, expected.payloadRef, `${expected.eventName} governance payload ref`);
    const currentSourceConsumers = m1014RevalidatedConsumers.get(expected.eventName);
    const expectedConsumers = currentSourceConsumers ?? expected.consumers;
    const governanceConsumers = governance?.consumers?.map((consumer) => ({ service: consumer?.service, consumerGroup: consumer?.consumerGroup }));
    if (currentSourceConsumers) {
      exactCurrentSourceConsumerRevalidation(errors, governanceConsumers, expectedConsumers, `${expected.eventName} governance consumers`);
    } else {
      exact(errors, governanceConsumers, expectedConsumers, `${expected.eventName} governance consumers`);
    }
    exact(errors, route?.topic, expected.topic, `${expected.eventName} B26 topic`);
    exact(errors, route?.partitionKey, 'aggregateId', `${expected.eventName} B26 partition key`);
    const expectedConsumerGroups = expectedConsumers.map((consumer) => consumer.consumerGroup);
    if (currentSourceConsumers) {
      exactCurrentSourceConsumerRevalidation(errors, route?.consumerGroups, expectedConsumerGroups, `${expected.eventName} B26 consumer groups`);
    } else {
      exact(errors, route?.consumerGroups, expectedConsumerGroups, `${expected.eventName} B26 consumer groups`);
    }
  }
  exact(errors, b26Runtime?.mode, 'static-only', 'B26 mode');
  exact(errors, b26Runtime?.runtimeStatus, 'pending', 'B26 runtime status');
  exact(errors, b26Runtime?.defaultDecision, 'NO-GO', 'B26 default decision');
  exact(errors, b26Runtime?.execution?.defaultAction, 'static-validate-only', 'B26 default action');
  exact(errors, b26Runtime?.execution?.runtimeEvidence, null, 'B26 runtime evidence');
  exact(errors, b26Runtime?.execution?.staticValidatorCannotPromoteRuntime, true, 'B26 static validator boundary');
  exact(errors, b26Runtime?.execution?.syntheticEvidenceCannotPromoteRuntime, true, 'B26 synthetic evidence boundary');
}

/**
 * Returns the policy's budget lane allocation for a supported quota. This is
 * deterministic static-rule evaluation, not a claim that a scheduler ran.
 */
export function dailyPlanBudget(policy, dailyQuotaMinutes) {
  const entry = (policy?.dailyPlan?.normalBudgets ?? []).find((value) => value?.dailyQuotaMinutes === dailyQuotaMinutes);
  if (!entry) return { result: 'FAIL', errors: [`unsupported daily quota ${dailyQuotaMinutes}`] };
  const expectedCap = Math.ceil(dailyQuotaMinutes * 1.10);
  const errors = [];
  add(errors, entry.totalCapMinutes === expectedCap, `daily quota ${dailyQuotaMinutes} total cap must equal CEILING(quota * 1.10)`);
  add(errors, entry.reviewRepairMinutes + entry.goalNewMinutes + entry.skillRotationMinutes <= entry.totalCapMinutes, `daily quota ${dailyQuotaMinutes} lane allocations exceed total cap`);
  return { result: errors.length === 0 ? 'PASS' : 'FAIL', errors, budget: structuredClone(entry) };
}

/** Pure CATCH_UP threshold evaluator used by adversarial tests. */
export function catchUpDecision(policy, { dailyQuotaMinutes, debtMinutes }) {
  const budget = dailyPlanBudget(policy, dailyQuotaMinutes);
  if (budget.result !== 'PASS' || !Number.isFinite(debtMinutes)) return { result: 'FAIL', errors: [...budget.errors, 'debtMinutes must be finite'] };
  const trigger = debtMinutes > 2 * budget.budget.reviewRepairMinutes;
  return { result: 'PASS', errors: [], trigger, budget: budget.budget };
}

function readCandidateField(candidate, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => value?.[key], candidate);
}

function compareScalar(left, right, direction, missingValue) {
  const leftValue = left ?? missingValue;
  const rightValue = right ?? missingValue;
  if (leftValue === rightValue) return 0;
  const result = leftValue < rightValue ? -1 : 1;
  return direction === 'DESC' ? -result : result;
}

/** Stable, locale-free comparison according to P1_DAILY_PLAN_V1's frozen tuple. */
export function compareDailyPlanCandidates(policy, left, right) {
  for (const part of policy?.dailyPlan?.stableSortTuple ?? []) {
    const comparison = compareScalar(readCandidateField(left, part.field), readCandidateField(right, part.field), part.direction, part.missingValue);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

const DECIMAL_LITERAL = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

/*
 * The policy says DECIMAL_ONLY.  These helpers never multiply binary floats
 * and never add an epsilon: they parse the caller's canonical decimal lexical
 * form, evaluate with BigInt coefficients, then round exactly once.  This is a
 * static rule evaluator, not a substitute for the service's decimal runtime.
 */
function decimalFrom(value) {
  const literal = typeof value === 'number'
    ? (Number.isFinite(value) ? String(value) : undefined)
    : (typeof value === 'string' ? value : undefined);
  if (!literal || !DECIMAL_LITERAL.test(literal)) return undefined;
  const negative = literal.startsWith('-');
  const unsigned = literal.replace(/^[+-]/, '');
  const [wholePart = '0', fractionPart = ''] = unsigned.split('.');
  const whole = wholePart === '' ? '0' : wholePart;
  const rawCoefficient = BigInt(`${whole}${fractionPart}`);
  return normalizeDecimal({
    coefficient: negative ? -rawCoefficient : rawCoefficient,
    scale: fractionPart.length,
    sourceScale: fractionPart.length,
  });
}

function normalizeDecimal(decimal) {
  let coefficient = decimal.coefficient;
  let scale = decimal.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale, sourceScale: decimal.sourceScale ?? decimal.scale };
}

function decimalInteger(value) {
  return { coefficient: BigInt(value), scale: 0, sourceScale: 0 };
}

function pow10(exponent) {
  return 10n ** BigInt(exponent);
}

function decimalAlign(left, right) {
  const scale = Math.max(left.scale, right.scale);
  return {
    left: left.coefficient * pow10(scale - left.scale),
    right: right.coefficient * pow10(scale - right.scale),
    scale,
  };
}

function decimalAdd(left, right) {
  const aligned = decimalAlign(left, right);
  return normalizeDecimal({ coefficient: aligned.left + aligned.right, scale: aligned.scale });
}

function decimalSubtract(left, right) {
  const aligned = decimalAlign(left, right);
  return normalizeDecimal({ coefficient: aligned.left - aligned.right, scale: aligned.scale });
}

function decimalMultiply(left, right) {
  return normalizeDecimal({ coefficient: left.coefficient * right.coefficient, scale: left.scale + right.scale });
}

function decimalCompare(left, right) {
  const aligned = decimalAlign(left, right);
  if (aligned.left === aligned.right) return 0;
  return aligned.left < aligned.right ? -1 : 1;
}

function decimalClamp(value, minimum, maximum) {
  if (decimalCompare(value, minimum) < 0) return minimum;
  if (decimalCompare(value, maximum) > 0) return maximum;
  return value;
}

function decimalRoundHalfUp(decimal, decimalPlaces) {
  if (!Number.isSafeInteger(decimalPlaces) || decimalPlaces < 0) return undefined;
  if (decimal.scale <= decimalPlaces) {
    return { coefficient: decimal.coefficient * pow10(decimalPlaces - decimal.scale), scale: decimalPlaces, sourceScale: decimalPlaces };
  }
  const divisor = pow10(decimal.scale - decimalPlaces);
  const sign = decimal.coefficient < 0n ? -1n : 1n;
  const absolute = decimal.coefficient < 0n ? -decimal.coefficient : decimal.coefficient;
  let coefficient = absolute / divisor;
  const remainder = absolute % divisor;
  if (remainder * 2n >= divisor) coefficient += 1n;
  return { coefficient: sign * coefficient, scale: decimalPlaces, sourceScale: decimalPlaces };
}

function decimalToString(decimal, minimumPlaces = decimal.scale) {
  const targetScale = Math.max(decimal.scale, minimumPlaces);
  const scaled = decimal.coefficient * pow10(targetScale - decimal.scale);
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(targetScale + 1, '0');
  const whole = targetScale === 0 ? digits : digits.slice(0, -targetScale);
  const fraction = targetScale === 0 ? '' : digits.slice(-targetScale);
  return `${negative ? '-' : ''}${whole}${targetScale === 0 ? '' : `.${fraction}`}`;
}

function decimalToNumber(decimal) {
  return Number(decimalToString(decimal));
}

function isNonNegativeSafeInteger(value, minimum) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function matchesPattern(value, pattern) {
  try {
    return typeof value === 'string' && typeof pattern === 'string' && pattern.length > 0 && new RegExp(pattern, 'u').test(value);
  } catch {
    return false;
  }
}

function isUtcRfc3339Z(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?Z$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match;
  const instant = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  return instant.getUTCFullYear() === Number(year)
    && instant.getUTCMonth() === Number(month) - 1
    && instant.getUTCDate() === Number(day)
    && instant.getUTCHours() === Number(hour)
    && instant.getUTCMinutes() === Number(minute)
    && instant.getUTCSeconds() === Number(second);
}

function validateNoObjectiveExpectedAuthority(policy, trustedOutcomeContext, errors) {
  const requirements = policy?.srs?.objectiveOutcomeAuthority?.noObjectiveExpected;
  add(errors, isRecord(trustedOutcomeContext), 'NO_OBJECTIVE_EXPECTED requires a server-predeclared trusted outcome context');
  if (!isRecord(trustedOutcomeContext) || !isRecord(requirements)) return;
  for (const field of requirements.requiredTrustedContextFields ?? []) add(errors, Object.hasOwn(trustedOutcomeContext, field), `NO_OBJECTIVE_EXPECTED trusted context requires ${field}`);
  add(errors, trustedOutcomeContext.authority === requirements.requiredAuthority, 'NO_OBJECTIVE_EXPECTED requires SERVER_PREDECLARED_LEGAL_PRACTICE_TYPE authority');
  const pin = trustedOutcomeContext.objectivePolicyPin;
  add(errors, isRecord(pin), 'NO_OBJECTIVE_EXPECTED requires a closed objectivePolicyPin');
  if (!isRecord(pin)) return;
  exactKeys(errors, pin, requirements.objectivePolicyPinRequiredFields ?? [], 'NO_OBJECTIVE_EXPECTED objectivePolicyPin');
  add(errors, (requirements.allowedPracticeTypes ?? []).includes(pin.practiceType), 'NO_OBJECTIVE_EXPECTED practiceType is not server-predeclared legal');
  add(errors, pin.objectiveExpected === requirements.requiredObjectiveExpected, 'NO_OBJECTIVE_EXPECTED objectiveExpected must be false');
  add(errors, typeof pin.policyVersion === 'string' && pin.policyVersion.length > 0, 'NO_OBJECTIVE_EXPECTED objective policyVersion is required');
  add(errors, matchesPattern(pin.policyDigest, requirements.policyDigestPattern), 'NO_OBJECTIVE_EXPECTED objective policyDigest is invalid');
}

function validateObjectiveExpectedAuthority(policy, trustedOutcomeContext, errors) {
  const authority = policy?.srs?.objectiveOutcomeAuthority;
  const requirements = authority?.objectiveExpected;
  const pinRequirements = authority?.noObjectiveExpected;
  add(errors, isRecord(trustedOutcomeContext), 'objective-scored outcome requires a trusted objectivePolicyPin context');
  if (!isRecord(trustedOutcomeContext) || !isRecord(requirements) || !isRecord(pinRequirements)) return;
  const pin = trustedOutcomeContext.objectivePolicyPin;
  add(errors, isRecord(pin), 'objective-scored outcome requires a closed objectivePolicyPin');
  if (!isRecord(pin)) return;
  exactKeys(errors, pin, pinRequirements.objectivePolicyPinRequiredFields ?? [], 'objective-scored objectivePolicyPin');
  add(errors, pin.practiceType === requirements.requiredPracticeType, 'objective-scored outcome must use OBJECTIVE_ASSESSMENT practiceType');
  add(errors, pin.objectiveExpected === requirements.requiredObjectiveExpected, 'objective-scored outcome objectiveExpected must be true');
  add(errors, typeof pin.policyVersion === 'string' && pin.policyVersion.length > 0, 'objective-scored outcome objective policyVersion is required');
  add(errors, matchesPattern(pin.policyDigest, pinRequirements.policyDigestPattern), 'objective-scored outcome objective policyDigest is invalid');
}

/** Deterministically applies the frozen SM2_Q03_V1 quality cap. */
export function effectiveQualityForOutcome(policy, rawQuality, objectiveOutcome, trustedOutcomeContext) {
  const errors = [];
  add(errors, Number.isInteger(rawQuality) && policy?.srs?.rawQualityValues?.includes(rawQuality), 'rawQuality must be one of 0, 1, 2, 3');
  add(errors, typeof objectiveOutcome === 'string' && policy?.srs?.objectiveOutcomes?.includes(objectiveOutcome), `objective outcome ${objectiveOutcome} is unknown or not legal for raw quality`);
  const cap = (policy?.srs?.qualityCaps ?? []).find((entry) => entry?.objectiveOutcome === objectiveOutcome);
  add(errors, isRecord(cap), `objective outcome ${objectiveOutcome} must have an explicit quality cap`);
  if (objectiveOutcome === 'NO_OBJECTIVE_EXPECTED') validateNoObjectiveExpectedAuthority(policy, trustedOutcomeContext, errors);
  else validateObjectiveExpectedAuthority(policy, trustedOutcomeContext, errors);
  if (errors.length) return { result: 'FAIL', errors };
  if (objectiveOutcome === 'UNANSWERED' || objectiveOutcome === 'REVEALED_BEFORE_ANSWER') return { result: 'PASS', errors: [], effectiveQuality: 0 };
  if (objectiveOutcome === 'INCORRECT') return { result: 'PASS', errors: [], effectiveQuality: Math.min(rawQuality, 1) };
  if (objectiveOutcome === 'GUESSED') return { result: 'PASS', errors: [], effectiveQuality: Math.min(rawQuality, 2) };
  return { result: 'PASS', errors: [], effectiveQuality: rawQuality };
}

export function roundHalfUp(value, decimalPlaces) {
  const decimal = decimalFrom(value);
  const rounded = decimal ? decimalRoundHalfUp(decimal, decimalPlaces) : undefined;
  return rounded ? decimalToNumber(rounded) : Number.NaN;
}

function deriveSrsStage(repetitions, intervalDays, effectiveQuality) {
  if (effectiveQuality < 2) return 'LEARNING';
  if (repetitions >= 6 && intervalDays >= 90) return 'CONSOLIDATED';
  if (repetitions >= 4 && intervalDays >= 30) return 'MASTERED';
  return 'LEARNING';
}

function validateSm2State(policy, state, errors) {
  add(errors, isRecord(state), 'SRS state must be an object');
  if (!isRecord(state)) return undefined;
  const rules = policy?.srs?.stateValidation;
  const easeFactor = decimalFrom(state.easeFactor);
  const minimumEaseFactor = decimalFrom(rules?.easeFactor?.minimum);
  const maximumEaseFactor = decimalFrom(rules?.easeFactor?.maximum);
  add(errors, Boolean(easeFactor), 'SRS state easeFactor must be a finite decimal literal');
  add(errors, Boolean(easeFactor) && easeFactor.sourceScale <= rules?.easeFactor?.maxDecimalPlaces, 'SRS state easeFactor exceeds the frozen decimal scale');
  add(errors, Boolean(easeFactor && minimumEaseFactor) && decimalCompare(easeFactor, minimumEaseFactor) >= 0, 'SRS state easeFactor is below the frozen minimum');
  add(errors, Boolean(easeFactor && maximumEaseFactor) && decimalCompare(easeFactor, maximumEaseFactor) <= 0, 'SRS state easeFactor exceeds the frozen maximum');
  add(errors, isNonNegativeSafeInteger(state.repetitions, rules?.repetitions?.minimum), 'SRS state repetitions must be a non-negative safe integer');
  add(errors, isNonNegativeSafeInteger(state.lapseCount, rules?.lapseCount?.minimum), 'SRS state lapseCount must be a non-negative safe integer');
  add(errors, Number.isSafeInteger(state.intervalDays)
    && state.intervalDays >= rules?.intervalDays?.minimum
    && state.intervalDays <= rules?.intervalDays?.maximum, 'SRS state intervalDays must be a bounded non-negative safe integer');
  return easeFactor;
}

/**
 * Deterministic algorithm model for contract tests. It deliberately does not
 * create dueAt: timezone/DST conversion stays a server/runtime boundary.
 */
export function transitionSm2Q03(policy, state, rawQuality, objectiveOutcome, trustedOutcomeContext) {
  const errors = [];
  const quality = effectiveQualityForOutcome(policy, rawQuality, objectiveOutcome, trustedOutcomeContext);
  if (quality.result !== 'PASS') return quality;
  const stateEaseFactor = validateSm2State(policy, state, errors);
  if (errors.length || !stateEaseFactor) return { result: 'FAIL', errors };
  const effectiveQuality = quality.effectiveQuality;
  const distance = decimalInteger(3 - effectiveQuality);
  const rawEaseFactor = decimalSubtract(
    decimalAdd(stateEaseFactor, decimalFrom('0.10')),
    decimalMultiply(distance, decimalAdd(decimalFrom('0.08'), decimalMultiply(distance, decimalFrom('0.02')))),
  );
  const easeFactorDecimal = decimalClamp(
    decimalRoundHalfUp(rawEaseFactor, 2),
    decimalFrom(policy.srs.stateValidation.easeFactor.minimum),
    decimalFrom(policy.srs.stateValidation.easeFactor.maximum),
  );
  const failed = effectiveQuality < 2;
  add(errors, !failed || state.lapseCount < Number.MAX_SAFE_INTEGER, 'SRS state lapseCount cannot overflow');
  add(errors, failed || state.repetitions < Number.MAX_SAFE_INTEGER, 'SRS state repetitions cannot overflow');
  if (errors.length) return { result: 'FAIL', errors };
  const repetitions = failed ? 0 : state.repetitions + 1;
  const lapseCount = failed ? state.lapseCount + 1 : state.lapseCount;
  let intervalDays;
  if (failed) intervalDays = 1;
  else if (repetitions <= 6) intervalDays = [1, 3, 7, 15, 30, 90][repetitions - 1];
  else {
    const projected = decimalRoundHalfUp(decimalMultiply(decimalInteger(state.intervalDays), easeFactorDecimal), 0);
    intervalDays = Number(decimalToString(decimalClamp(projected, decimalInteger(1), decimalInteger(365))));
  }
  return {
    result: 'PASS',
    errors: [],
    state: {
      easeFactor: decimalToNumber(easeFactorDecimal),
      repetitions,
      intervalDays,
      lapseCount,
      srsStage: deriveSrsStage(repetitions, intervalDays, effectiveQuality),
    },
    effectiveQuality,
  };
}

/** Validates that SRS, repair and mastery remain independent state dimensions. */
export function validateStateSeparation(policy, state) {
  const errors = [];
  add(errors, isRecord(state), 'state separation payload must be an object');
  if (!isRecord(state)) return { result: 'FAIL', errors };
  add(errors, SRS_STAGES.includes(state.srsStage), 'SRS stage must use the frozen SRS state domain');
  add(errors, REPAIR_STATES.includes(state.repairWorkflowState), 'repair workflow state must use the frozen repair state domain');
  add(errors, MASTERY_STAGES.includes(state.masteryStage), 'mastery stage must use the frozen mastery state domain');
  add(errors, !Object.hasOwn(state, 'sharedLearningState'), 'sharedLearningState is prohibited; SRS/repair/mastery must be independent');
  add(errors, !Object.hasOwn(state, 'state') || state.state === undefined, 'a generic coupled state authority is prohibited');
  add(errors, policy?.srs?.srsStages?.includes(state.srsStage), 'policy must recognize the supplied SRS stage');
  add(errors, policy?.repair?.workflowStates?.includes(state.repairWorkflowState), 'policy must recognize the supplied repair state');
  add(errors, policy?.mastery?.masteryStages?.includes(state.masteryStage), 'policy must recognize the supplied mastery stage');
  return { result: errors.length === 0 ? 'PASS' : 'FAIL', errors };
}

/**
 * Validates an offline command boundary. acceptedReceipts is an already-scoped
 * receipt ledger supplied by the caller; this pure checker neither persists nor
 * delivers events and makes no runtime reliability claim.
 */
export function validateOfflineCommand(policy, command, acceptedReceipts = []) {
  const errors = [];
  add(errors, isRecord(command), 'offline command must be an object');
  if (!isRecord(command)) return { result: 'FAIL', errors };
  const offline = policy?.offlineAndIdempotency;
  const constraints = offline?.commandFieldConstraints;
  for (const field of offline?.requiredClientFields ?? []) {
    add(errors, command[field] !== undefined && command[field] !== null && command[field] !== '', `offline command requires ${field}`);
  }
  for (const field of offline?.serverDerivedFields ?? []) add(errors, !Object.hasOwn(command, field), `offline command must not supply server-derived ${field}`);
  add(errors, matchesPattern(command.clientEventId, constraints?.clientEventIdPattern), 'offline clientEventId must match the frozen identifier pattern');
  add(errors, isNonNegativeSafeInteger(command.clientSeq, constraints?.clientSeq?.minimum), 'offline clientSeq must be a positive safe integer');
  add(errors, isNonNegativeSafeInteger(command.baseStateVersion, constraints?.baseStateVersion?.minimum), 'offline baseStateVersion must be a non-negative safe integer');
  add(errors, isNonNegativeSafeInteger(command.contentVersionId, constraints?.contentVersionId?.minimum), 'offline contentVersionId must be a positive safe integer');
  add(errors, matchesPattern(command.payloadHash, constraints?.payloadHashPattern), 'offline payloadHash must be a lowercase SHA-256 digest');
  add(errors, Number.isInteger(command.rawQuality) && constraints?.rawQualityValues?.includes(command.rawQuality), 'offline rawQuality must be a frozen integer enum');
  add(errors, Array.isArray(acceptedReceipts), 'offline acceptedReceipts must be an array for replay/order validation');
  if (!Array.isArray(acceptedReceipts)) return { result: 'FAIL', errors };
  for (const receipt of acceptedReceipts) {
    add(errors, isRecord(receipt), 'offline receipt ledger entry must be an object');
    if (!isRecord(receipt)) continue;
    add(errors, matchesPattern(receipt.clientEventId, constraints?.clientEventIdPattern), 'offline receipt clientEventId must be valid');
    add(errors, isNonNegativeSafeInteger(receipt.clientSeq, constraints?.clientSeq?.minimum), 'offline receipt clientSeq must be valid');
    add(errors, matchesPattern(receipt.payloadHash, constraints?.payloadHashPattern), 'offline receipt payloadHash must be valid');
  }
  const sameEvent = acceptedReceipts.filter((receipt) => receipt?.clientEventId === command.clientEventId);
  if (sameEvent.length > 0) {
    const receipt = sameEvent[0];
    if (receipt?.payloadHash !== command.payloadHash) {
      errors.push('offline same clientEventId with a different payloadHash must conflict with 409');
    } else if (errors.length === 0) {
      return {
        result: 'PASS',
        errors: [],
        decision: offline?.replayPolicy?.sameEventSamePayload,
        originalReceipt: structuredClone(receipt),
      };
    }
  }
  if (sameEvent.length === 0) {
    const priorSequences = acceptedReceipts.map((receipt) => receipt?.clientSeq).filter(Number.isSafeInteger);
    if (priorSequences.length > 0) {
      const lastSequence = Math.max(...priorSequences);
      add(errors, command.clientSeq > lastSequence, 'offline clientSeq must be strictly increasing within the supplied dedupe scope');
    }
  }
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    ...(errors.length === 0 ? { decision: 'ACCEPT_NEW' } : {}),
  };
}

function metricExpectedRate(numerator, denominator, validation) {
  if (!Number.isSafeInteger(validation?.rateMultiplier) || validation.rateMultiplier <= 0
    || !Number.isSafeInteger(validation?.rateDecimalPlaces) || validation.rateDecimalPlaces < 0) return undefined;
  const numeratorDecimal = decimalFrom(numerator);
  const denominatorDecimal = decimalFrom(denominator);
  if (!numeratorDecimal || !denominatorDecimal || denominatorDecimal.coefficient <= 0n) return undefined;
  const multiplier = BigInt(validation.rateMultiplier);
  const places = validation.rateDecimalPlaces;
  const scaledNumerator = numeratorDecimal.coefficient * pow10(denominatorDecimal.scale) * multiplier * pow10(places);
  const scaledDenominator = denominatorDecimal.coefficient * pow10(numeratorDecimal.scale);
  let coefficient = scaledNumerator / scaledDenominator;
  if ((scaledNumerator % scaledDenominator) * 2n >= scaledDenominator) coefficient += 1n;
  return decimalToString({ coefficient, scale: places }, places);
}

function validateMetricValue(metric, definition, snapshotStatus, validation, errors) {
  const label = `report metric ${metric?.code ?? 'UNKNOWN'}`;
  exactKeys(errors, metric, ['code', 'numerator', 'denominator', 'value', 'status'], label);
  add(errors, typeof metric?.status === 'string' && ['PROCESSING', 'READY', 'NOT_APPLICABLE', 'FAILED'].includes(metric.status), `${label} has an invalid metric status`);
  if (snapshotStatus === 'NOT_APPLICABLE') {
    add(errors, metric?.status === 'NOT_APPLICABLE', `${label} must be NOT_APPLICABLE when its snapshot is NOT_APPLICABLE`);
    add(errors, metric?.numerator === null && metric?.denominator === null && metric?.value === null, `${label} NOT_APPLICABLE snapshot fields must all be null`);
    return;
  }
  if (metric?.status === validation?.processingMetricStatus || metric?.status === 'FAILED') {
    add(errors, metric.numerator === null && metric.denominator === null && metric.value === null, `${label} ${metric.status} fields must all be null`);
    return;
  }
  if (definition?.denominator === null) {
    add(errors, metric?.status === 'READY', `${label} count metric must be READY when source watermarks are present`);
    add(errors, Number.isFinite(metric?.numerator) && metric.numerator >= 0, `${label} numerator must be a non-negative number`);
    add(errors, metric?.denominator === null, `${label} count metric denominator must be null`);
    add(errors, Number.isFinite(metric?.value) && metric.value >= 0 && decimalFrom(metric.value) && decimalFrom(metric.numerator)
      && decimalToString(decimalFrom(metric.value)) === decimalToString(decimalFrom(metric.numerator)), `${label} count metric value must equal its numeric numerator`);
    return;
  }
  add(errors, Number.isFinite(metric?.numerator) && metric.numerator >= 0, `${label} numerator must be a non-negative number`);
  add(errors, Number.isFinite(metric?.denominator) && metric.denominator >= 0, `${label} denominator must be a non-negative number`);
  if (metric?.denominator === 0) {
    add(errors, metric.status === 'NOT_APPLICABLE', `${label} zero denominator must be NOT_APPLICABLE`);
    add(errors, metric.value === null, `${label} zero denominator value must be null, never an arbitrary zero`);
    return;
  }
  const expectedRate = metricExpectedRate(metric?.numerator, metric?.denominator, validation);
  add(errors, metric?.status === 'READY', `${label} positive denominator must be READY`);
  add(errors, Number.isFinite(metric?.value) && metric.value >= 0, `${label} value must be a non-negative number`);
  const actualDecimal = decimalFrom(metric?.value);
  const roundedActual = actualDecimal && Number.isSafeInteger(validation?.rateDecimalPlaces)
    ? decimalRoundHalfUp(actualDecimal, validation.rateDecimalPlaces)
    : undefined;
  add(errors, Boolean(roundedActual) && decimalToString(roundedActual, validation.rateDecimalPlaces) === expectedRate, `${label} value must equal the frozen rounded numerator/denominator rate`);
  if (snapshotStatus === 'PROCESSING') add(errors, false, `${label} cannot be READY while its snapshot is PROCESSING`);
}

/** Validates report snapshot combinations without claiming a report worker ran. */
export function validateReportSnapshot(policy, snapshot) {
  const errors = [];
  add(errors, isRecord(snapshot), 'report snapshot must be an object');
  if (!isRecord(snapshot)) return { result: 'FAIL', errors };
  const report = policy?.report;
  const validation = report?.snapshotValidation;
  const required = report?.snapshotRequiredFields ?? [];
  for (const field of required) add(errors, Object.hasOwn(snapshot, field), `report snapshot requires ${field}`);
  add(errors, typeof snapshot.reportId === 'string' && snapshot.reportId.length > 0, 'report snapshot reportId must be a non-empty string');
  add(errors, Number.isSafeInteger(snapshot.reportVersion) && snapshot.reportVersion >= 1, 'report snapshot reportVersion must be a positive safe integer');
  add(errors, snapshot.reportRuleVersion === report?.ruleVersion, 'report snapshot reportRuleVersion must be the frozen report rule');
  add(errors, snapshot.metricDefinitionsVersion === report?.ruleVersion, 'report snapshot metricDefinitionsVersion must be the frozen report rule');
  add(errors, isUtcRfc3339Z(snapshot.asOf), 'report snapshot asOf must be a UTC RFC3339 Z instant');
  exactKeys(errors, snapshot.window, ['startInclusive', 'endExclusive'], 'report snapshot window');
  add(errors, isUtcRfc3339Z(snapshot.window?.startInclusive) && isUtcRfc3339Z(snapshot.window?.endExclusive), 'report snapshot window must use UTC RFC3339 Z instants');
  add(errors, Date.parse(snapshot.window?.endExclusive) > Date.parse(snapshot.window?.startInclusive), 'report snapshot window must have endExclusive after startInclusive');
  add(errors, isRecord(snapshot.inputVersions), 'report snapshot inputVersions must be an object');
  add(errors, matchesPattern(snapshot.sourceFactDigest, validation?.digestPattern), 'report snapshot sourceFactDigest must be a lowercase SHA-256 digest');
  add(errors, report?.snapshotStatuses?.includes(snapshot.status), 'report snapshot status is not a frozen status');

  const processing = snapshot.status === 'PROCESSING';
  if (processing) {
    add(errors, snapshot.sourceWatermarks === null && snapshot.sourceWatermarkDigest === null, 'PROCESSING report snapshot requires null source watermarks and digest');
  } else {
    add(errors, isRecord(snapshot.sourceWatermarks), 'non-PROCESSING report snapshot requires a source watermark object');
    if (isRecord(snapshot.sourceWatermarks)) {
      exact(errors, Object.keys(snapshot.sourceWatermarks).sort(), [...(report?.requiredSourceOwners ?? [])].sort(), 'report source watermark owner set');
      for (const owner of report?.requiredSourceOwners ?? []) add(errors, matchesPattern(snapshot.sourceWatermarks[owner], validation?.watermarkPattern), `report source watermark for ${owner} is invalid`);
    }
    add(errors, matchesPattern(snapshot.sourceWatermarkDigest, validation?.digestPattern), 'non-PROCESSING report snapshot sourceWatermarkDigest must be a lowercase SHA-256 digest');
  }

  const definitions = new Map((report?.metricDefinitions ?? []).map((definition) => [definition?.code, definition]));
  const metrics = snapshot.metrics;
  add(errors, Array.isArray(metrics), 'report snapshot metrics must be an array');
  if (Array.isArray(metrics)) {
    add(errors, metrics.length === definitions.size, 'report snapshot must include exactly the frozen metric inventory');
    add(errors, new Set(metrics.map((metric) => metric?.code)).size === metrics.length, 'report snapshot metric codes must be unique');
    for (const metric of metrics) {
      const definition = definitions.get(metric?.code);
      add(errors, isRecord(definition), `report metric ${metric?.code ?? 'UNKNOWN'} is not in the frozen definition inventory`);
      if (!isRecord(definition)) continue;
      validateMetricValue(metric, definition, snapshot.status, validation, errors);
    }
    if (processing) add(errors, metrics.every((metric) => metric?.status === validation?.processingMetricStatus && metric?.numerator === null && metric?.denominator === null && metric?.value === null), 'PROCESSING report snapshot must have only null PROCESSING metrics');
    if (snapshot.status === 'READY') add(errors, metrics.every((metric) => ['READY', 'NOT_APPLICABLE'].includes(metric?.status)), 'READY report snapshot may not contain PROCESSING or FAILED metrics');
    if (snapshot.status === 'PARTIAL') add(errors, metrics.some((metric) => ['READY', 'NOT_APPLICABLE'].includes(metric?.status)) && metrics.some((metric) => ['PROCESSING', 'FAILED'].includes(metric?.status)), 'PARTIAL report snapshot must carry both settled and unsettled metric states');
    if (snapshot.status === 'FAILED') add(errors, metrics.every((metric) => metric?.status === 'FAILED'), 'FAILED report snapshot must carry only FAILED null metrics');
    if (snapshot.status === 'NOT_APPLICABLE') add(errors, metrics.every((metric) => metric?.status === 'NOT_APPLICABLE' && metric?.numerator === null && metric?.denominator === null && metric?.value === null), 'NOT_APPLICABLE report snapshot must carry only null NOT_APPLICABLE metrics');
  }

  const lateFields = report?.lateEvent?.lateSnapshotRequiredFields ?? [];
  const presentLateFields = lateFields.filter((field) => Object.hasOwn(snapshot, field));
  add(errors, presentLateFields.length === 0 || presentLateFields.length === lateFields.length, 'late-event report lineage fields must be all present or all absent');
  if (presentLateFields.length === lateFields.length && lateFields.length > 0) {
    add(errors, snapshot.status !== 'PROCESSING', 'late-event report rebuild cannot be PROCESSING');
    add(errors, Number.isSafeInteger(snapshot.supersedesReportVersion) && snapshot.supersedesReportVersion >= 1 && snapshot.reportVersion > snapshot.supersedesReportVersion, 'late-event rebuild must create a newer report version');
    add(errors, matchesPattern(snapshot.lateSourceFactId, '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'), 'late-event lateSourceFactId is invalid');
    add(errors, matchesPattern(snapshot.lateSourceWatermark, validation?.watermarkPattern), 'late-event lateSourceWatermark is invalid');
  }
  return { result: errors.length === 0 ? 'PASS' : 'FAIL', errors };
}

export function validateLearningLoopContractData(input = {}) {
  const errors = [];
  add(errors, isRecord(input.policy), 'learning-loop policy must be an object');
  if (isRecord(input.policy)) {
    checkPolicy(input.policy, errors, input.frozenPolicyDigest ?? FROZEN_POLICY_SHA256);
    checkSourceArtifacts(input, errors);
  }
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    summary: {
      taskId: input.policy?.task,
      maturity: input.policy?.maturity,
      runtimeStatus: input.policy?.runtimeStatus,
      staticContractOnly: input.policy?.runtimeBoundary?.staticContractOnly === true,
      sourceBaseline: input.policy?.sourceBaseline,
      promotionScope: input.policy?.compatibilityPromotion?.scope,
      approvedCanonicalEvents: input.policy?.compatibilityPromotion?.approvedCanonicalEvents?.length ?? 0,
      deferredEventCandidates: input.policy?.deferredEventCandidates?.length ?? 0,
      adversarialCases: input.policy?.adversarialCases?.length ?? 0,
    },
    errors,
  };
}

export function readLearningLoopContractInputs({ root = defaultRoot } = {}) {
  const readErrors = [];
  const input = {
    policy: readExistingJson(root, DEFAULT_LEARNING_LOOP_POLICY, readErrors, 'learning-loop policy'),
    b10OpenApi: readExistingJson(root, DEFAULT_B10_OPENAPI, readErrors, 'B10 fragment'),
    b1OpenApi: readExistingJson(root, DEFAULT_B1_OPENAPI, readErrors, 'B1 onboarding fragment'),
    b9FirstDayOpenApi: readExistingJson(root, DEFAULT_B9_OPENAPI, readErrors, 'B9 first-day projection fragment'),
    b2CompatibilityOpenApi: readExistingJson(root, DEFAULT_B2_COMPATIBILITY_OPENAPI, readErrors, 'B2 compatibility fragment'),
    b2SrsOpenApi: readExistingJson(root, DEFAULT_B2_SRS_OPENAPI, readErrors, 'B2 SRS fragment'),
    b2MasteryOpenApi: readExistingJson(root, DEFAULT_B2_MASTERY_OPENAPI, readErrors, 'B2 mastery fragment'),
    b10EventFragment: readExistingJson(root, DEFAULT_B10_EVENT_FRAGMENT, readErrors, 'B10 event fragment'),
    b10LearningLoopEventFragment: readExistingJson(root, DEFAULT_B10_LEARNING_LOOP_EVENT_FRAGMENT, readErrors, 'B10 learning-loop event fragment'),
    b2SrsEventFragment: readExistingJson(root, DEFAULT_B2_SRS_EVENT_FRAGMENT, readErrors, 'B2 SRS event fragment'),
    b2MasteryEventFragment: readExistingJson(root, DEFAULT_B2_MASTERY_EVENT_FRAGMENT, readErrors, 'B2 mastery event fragment'),
    m1014CurrentSourcePolicy: readExistingJson(root, DEFAULT_M1014_CURRENT_SOURCE_POLICY, readErrors, 'M1-014 current-source policy'),
    catalog: readExistingJson(root, DEFAULT_EVENT_CATALOG, readErrors, 'event catalog'),
    b26Runtime: readExistingJson(root, DEFAULT_B26_RUNTIME, readErrors, 'B26 runtime policy'),
    generatedOpenApi: readExistingText(root, DEFAULT_GENERATED_OPENAPI, readErrors, 'generated OpenAPI TypeScript'),
    generatedEvents: readExistingText(root, DEFAULT_GENERATED_EVENTS, readErrors, 'generated event TypeScript'),
    generatedIndex: readExistingText(root, DEFAULT_GENERATED_INDEX, readErrors, 'generated contract TypeScript barrel'),
    generatedSchemas: readExistingText(root, DEFAULT_GENERATED_SCHEMAS, readErrors, 'generated schema utility TypeScript'),
    generatedApiClient: readExistingText(root, DEFAULT_GENERATED_API_CLIENT, readErrors, 'generated API client TypeScript'),
  };
  if (readErrors.length) input.readErrors = readErrors;
  return input;
}

export function validateLearningLoopContract(options = {}) {
  const input = readLearningLoopContractInputs(options);
  const report = validateLearningLoopContractData(input);
  if (input.readErrors?.length) {
    report.errors.unshift(...input.readErrors);
    report.result = 'FAIL';
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  try {
    const report = validateLearningLoopContract();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`P1R learning-loop contract ${report.result} (${report.summary.adversarialCases} adversarial cases, runtimeStatus=${report.summary.runtimeStatus || 'UNKNOWN'}).`);
      for (const error of report.errors) console.error(`- ${error}`);
    }
    if (report.result !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
