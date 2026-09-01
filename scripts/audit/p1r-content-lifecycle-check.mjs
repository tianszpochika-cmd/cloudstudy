import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { listEventFragments, validateEventGovernanceData } from './p1r-event-governance-check.mjs';
import { validateEventReliabilityData } from './p1r-event-reliability-check.mjs';
import { validateB26EventRuntime } from '../runtime/validate-b26-event-runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, '..', '..');

export const DEFAULT_CONTENT_LIFECYCLE_POLICY = 'config/p1r-content-lifecycle.v1.json';
const DEFAULT_PLACEMENT_POLICY = 'config/p1r-placement-contract.v1.json';
const FROZEN_PLACEMENT_POLICY_SHA256 = '9eb39bdaa5f4965d3940b3718dbaf519832948912acaaf5a3d78954dcc4f303b';
const B9_OPENAPI_PATH = 'packages/contracts/fragments/b9/b9-content.openapi.json';
const B9_SHARED_OPENAPI_PATH = 'packages/contracts/fragments/b9/b9-shared.openapi.json';
const B1_OPENAPI_PATH = 'packages/contracts/fragments/b1-content.openapi.json';
const B10_OPENAPI_PATH = 'packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json';
const B26_FRAGMENT_PATH = 'packages/contracts/events/v1/fragments/b26-reliability.events.json';

const PERSISTENT_STATES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'];
const REVIEW_STAGES = ['FIRST_REVIEW', 'FINAL_REVIEW'];
const REVIEW_DECISIONS = ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'];
const REVIEW_RECORD_FIELDS = ['contentVersionId', 'contentHash', 'reviewStage', 'decision', 'reviewVersion', 'auditId', 'decidedAt'];
const REVIEW_RECORD_POLICY = {
  policyId: 'P1R-B9-REVIEW-CHAIN-V1',
  scope: 'CURRENT_CONTENT_VERSION_CHAIN',
  collectionSemantics: 'STAGE_KEYED_SET_ORDER_INDEPENDENT',
  allowedShapes: ['EMPTY', 'FIRST_ONLY', 'FIRST_AND_FINAL'],
  recordIdentityFields: ['contentVersionId', 'contentHash'],
  identityConstraint: 'ALL_RECORDS_SAME_AND_MATCH_EXACTLY_ONE_VERSION_SUMMARY',
  allowedStageSets: [[], ['FIRST_REVIEW'], ['FIRST_REVIEW', 'FINAL_REVIEW']],
  workflowStageOrder: ['FIRST_REVIEW', 'FINAL_REVIEW'],
  stageMaxOccurrences: { FIRST_REVIEW: 1, FINAL_REVIEW: 1 },
  finalPrerequisite: {
    predecessorStage: 'FIRST_REVIEW', predecessorDecision: 'APPROVED',
    sameIdentityFields: ['contentVersionId', 'contentHash'], precedence: 'STRICTLY_PRECEDES',
  },
  reviewVersionUniquenessScope: ['contentVersionId', 'contentHash', 'reviewStage'],
  approvedOrLaterStatesRequireBothApproved: ['APPROVED', 'PUBLISHED', 'ARCHIVED'],
  writer: 'SERVER_DERIVED_READ_ONLY',
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
};
const REVIEW_RECORD_STAGE_BRANCHES = REVIEW_STAGES.map(function (reviewStage) {
  return { required: ['reviewStage'], properties: { reviewStage: { enum: [reviewStage] } } };
});
const REVIEW_RECORD_ARRAY_BRANCHES = [
  { minItems: 0, maxItems: 0 },
  {
    minItems: 1, maxItems: 1,
    items: { type: 'object', required: ['reviewStage'], properties: { reviewStage: { enum: ['FIRST_REVIEW'] } } },
  },
  {
    minItems: 2, maxItems: 2,
    allOf: REVIEW_STAGES.map(function (reviewStage) {
      return {
        not: {
          items: { type: 'object', required: ['reviewStage'], properties: { reviewStage: { enum: [reviewStage] } } },
        },
      };
    }),
  },
];
const B9_REVIEWED_EVENT_PAYLOAD = {
  $id: 'platform.events.content.version.reviewed.v1.payload',
  type: 'object',
  additionalProperties: false,
  required: ['tenantId', 'contentCode', 'contentVersionId', 'versionNumber', 'contentHash', 'stateVersion', 'commandId', 'auditId', 'reviewStage', 'decision', 'reviewVersion', 'reviewedAt'],
  properties: {
    tenantId: { type: 'string', pattern: '^[a-z][a-z0-9_-]{1,63}$' },
    contentCode: { type: 'string', maxLength: 128 },
    contentVersionId: { type: 'integer', minimum: 1 },
    versionNumber: { type: 'integer', minimum: 1 },
    contentHash: { type: 'string', pattern: '^[a-fA-F0-9]{64}$' },
    stateVersion: { type: 'integer', minimum: 1 },
    commandId: { type: 'string', pattern: '^cmd_[A-Za-z0-9._:-]{15,127}$' },
    auditId: { type: 'string', pattern: '^aud_[A-Za-z0-9._:-]{15,127}$' },
    reviewStage: { type: 'string', enum: REVIEW_STAGES },
    decision: { type: 'string', enum: REVIEW_DECISIONS },
    reviewVersion: { type: 'integer', minimum: 1 },
    reviewedAt: { type: 'string', format: 'date-time' },
  },
};
const CANONICAL_ENVELOPE = [
  'eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType',
  'aggregateId', 'actorId', 'traceId', 'requestId', 'schemaVersion', 'dedupeKey', 'payload',
];
const CANONICAL_CONTENT_EVENTS = [
  'content.version.submitted.v1',
  'content.version.reviewed.v1',
  'content.version.published.v1',
  'content.version.unpublished.v1',
  'content.version.rolled_back.v1',
];
const M1016_NOTIFICATION_BINDING_CLOSURE = {
  gapId: 'EVENT-GAP-BIND-NOTIF-001',
  family: 'EVENT-GAP-BIND',
  status: 'D2_CONTRACT_CLOSED',
  d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-016'],
};
const M1017_PRIVACY_BINDING_CLOSURE = {
  gapId: 'EVENT-GAP-BIND-PRIV-001',
  family: 'EVENT-GAP-BIND',
  status: 'D2_CONTRACT_CLOSED',
  d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-017'],
};
const M1017_ACCOUNT_DELETION_CLOSURE = {
  gapId: 'EVENT-GAP-USR-DEL-001',
  family: 'EVENT-GAP-USR-DEL',
  status: 'D2_CONTRACT_CLOSED',
  d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-017'],
};
const EXPECTED_GLOBAL_D2_CLOSED_EVENT_GAPS = [
  'EVENT-GAP-IAM-001',
  'EVENT-GAP-BIND-IAM-001',
  'EVENT-GAP-BIND-IAM-002',
  'EVENT-GAP-ONB-001',
  'EVENT-GAP-ONB-002',
  'EVENT-GAP-PLACEMENT-PLAN',
  'EVENT-GAP-CONTENT-DUPLICATE',
  'EVENT-GAP-BIND-CONT-001',
  'EVENT-GAP-BIND-ASM-001',
  'EVENT-GAP-BIND-LRN-001',
  'EVENT-GAP-BIND-GAM-001',
  'EVENT-GAP-BIND-SOC-001',
  M1016_NOTIFICATION_BINDING_CLOSURE.gapId,
  M1017_PRIVACY_BINDING_CLOSURE.gapId,
  M1017_ACCOUNT_DELETION_CLOSURE.gapId,
  'EVENT-GAP-BIND',
];
const EXPECTED_GLOBAL_PLANNED_EVENT_GAPS = [];
const HISTORICAL_CONTENT_EVENTS = [
  'content.public_projection.invalidated.v1',
  'cms.content.submitted.v1',
  'cms.review.decided.v1',
  'cms.content.published.v1',
  'cms.content.rolled_back.v1',
  'cms.content.version_saved.v1',
  'cms.import.completed.v1',
];
const AGGREGATE_FIELDS = {
  'content.version.submitted.v1': 'contentVersionId',
  'content.version.reviewed.v1': 'contentVersionId',
  'content.version.published.v1': 'contentVersionId',
  'content.version.unpublished.v1': 'contentVersionId',
  'content.version.rolled_back.v1': 'contentCode',
};
const CONTENT_ROUTES = {
  'content.version.submitted.v1': ['cg.admin-ops-from-content.v1', 'cg.audit-from-content.v1'],
  'content.version.reviewed.v1': ['cg.admin-ops-from-content.v1', 'cg.audit-from-content.v1'],
  'content.version.published.v1': ['cg.learner-from-content.v1', 'cg.learning-from-content.v1', 'cg.assessment-from-content.v1', 'cg.admin-ops-from-content.v1', 'cg.audit-from-content.v1'],
  'content.version.unpublished.v1': ['cg.learner-from-content.v1', 'cg.learning-from-content.v1', 'cg.assessment-from-content.v1', 'cg.admin-ops-from-content.v1', 'cg.audit-from-content.v1'],
  'content.version.rolled_back.v1': ['cg.learner-from-content.v1', 'cg.learning-from-content.v1', 'cg.assessment-from-content.v1', 'cg.admin-ops-from-content.v1', 'cg.audit-from-content.v1'],
};
const COMMANDS = [
  { name: 'CREATE_DRAFT', actorClass: 'EDITOR', fromStates: [], toStates: ['DRAFT'], idempotencyScope: 'contentCode+command+requestDigest', publicationEffect: 'NONE' },
  { name: 'SAVE_DRAFT', actorClass: 'EDITOR', fromStates: ['DRAFT'], toStates: ['DRAFT'], idempotencyScope: 'contentVersionId+command+requestDigest', publicationEffect: 'NONE' },
  { name: 'VALIDATE_DRAFT', actorClass: 'EDITOR', fromStates: ['DRAFT'], toStates: ['DRAFT'], idempotencyScope: 'contentVersionId+command+requestDigest', publicationEffect: 'NONE' },
  { name: 'SUBMIT_REVIEW', actorClass: 'EDITOR', fromStates: ['DRAFT'], toStates: ['IN_REVIEW'], idempotencyScope: 'contentVersionId+command+requestDigest', publicationEffect: 'NONE' },
  { name: 'REVIEW_FIRST', actorClass: 'FIRST_REVIEWER', fromStates: ['IN_REVIEW'], toStates: ['IN_REVIEW', 'DRAFT'], idempotencyScope: 'contentVersionId+reviewStage+reviewVersion', publicationEffect: 'NONE' },
  { name: 'REVIEW_FINAL', actorClass: 'FINAL_REVIEWER', fromStates: ['IN_REVIEW'], toStates: ['APPROVED', 'DRAFT'], idempotencyScope: 'contentVersionId+reviewStage+reviewVersion', publicationEffect: 'NONE' },
  { name: 'PUBLISH', actorClass: 'RELEASE_OPERATOR', fromStates: ['APPROVED'], toStates: ['PUBLISHED'], idempotencyScope: 'contentCode+targetVersionNumber+command', publicationEffect: 'SET_PUBLIC_POINTER' },
  { name: 'SCHEDULE_PUBLISH', actorClass: 'RELEASE_OPERATOR', fromStates: ['APPROVED'], toStates: ['APPROVED'], idempotencyScope: 'contentVersionId+scheduledAt+command', publicationEffect: 'CREATE_SCHEDULE' },
  { name: 'CANCEL_SCHEDULED_PUBLISH', actorClass: 'RELEASE_OPERATOR', fromStates: ['APPROVED'], toStates: ['APPROVED'], idempotencyScope: 'scheduledPublishTaskId+command', publicationEffect: 'CANCEL_SCHEDULE' },
  { name: 'UNPUBLISH', actorClass: 'RELEASE_OPERATOR', fromStates: ['PUBLISHED'], toStates: ['PUBLISHED'], idempotencyScope: 'contentCode+contentEpoch+command', publicationEffect: 'CLEAR_PUBLIC_POINTER' },
  { name: 'ROLLBACK', actorClass: 'RELEASE_OPERATOR', fromStates: ['PUBLISHED'], toStates: ['PUBLISHED'], idempotencyScope: 'contentCode+targetVersionNumber+contentEpoch+command', publicationEffect: 'REPOINT_PUBLIC_POINTER' },
];
const COMMAND_REQUEST_BASE_FIELDS = ['command', 'contentCode', 'expectedStateVersion'];
const COMMAND_REQUEST_PROPERTIES = [
  'command', 'contentCode', 'expectedStateVersion', 'targetVersionNumber', 'reasonCode',
  'content', 'reviewDecision', 'reviewNote', 'schedule', 'scheduledPublishTaskId',
];
const B9_COMMAND_FIELD_POLICY = {
  CREATE_DRAFT: { required: ['content'], allowed: ['command', 'contentCode', 'expectedStateVersion', 'content'] },
  SAVE_DRAFT: { required: ['content'], allowed: ['command', 'contentCode', 'expectedStateVersion', 'content'] },
  VALIDATE_DRAFT: { required: [], allowed: ['command', 'contentCode', 'expectedStateVersion'] },
  SUBMIT_REVIEW: { required: [], allowed: ['command', 'contentCode', 'expectedStateVersion'] },
  REVIEW_FIRST: { required: ['reviewDecision'], allowed: ['command', 'contentCode', 'expectedStateVersion', 'reviewDecision', 'reviewNote'] },
  REVIEW_FINAL: { required: ['reviewDecision'], allowed: ['command', 'contentCode', 'expectedStateVersion', 'reviewDecision', 'reviewNote'] },
  PUBLISH: { required: ['targetVersionNumber'], allowed: ['command', 'contentCode', 'expectedStateVersion', 'targetVersionNumber'] },
  SCHEDULE_PUBLISH: { required: ['schedule'], allowed: ['command', 'contentCode', 'expectedStateVersion', 'schedule'] },
  CANCEL_SCHEDULED_PUBLISH: { required: ['scheduledPublishTaskId'], allowed: ['command', 'contentCode', 'expectedStateVersion', 'scheduledPublishTaskId', 'reasonCode'] },
  UNPUBLISH: { required: ['reasonCode'], allowed: ['command', 'contentCode', 'expectedStateVersion', 'reasonCode'] },
  ROLLBACK: { required: ['targetVersionNumber', 'reasonCode'], allowed: ['command', 'contentCode', 'expectedStateVersion', 'targetVersionNumber', 'reasonCode'] },
};
const B9_COMMAND_ONE_OF = [
  { commands: ['CREATE_DRAFT', 'SAVE_DRAFT'], required: ['content'], forbidden: ['targetVersionNumber', 'reasonCode', 'reviewDecision', 'reviewNote', 'schedule', 'scheduledPublishTaskId'] },
  { commands: ['VALIDATE_DRAFT'], required: [], forbidden: ['targetVersionNumber', 'reasonCode', 'content', 'reviewDecision', 'reviewNote', 'schedule', 'scheduledPublishTaskId'] },
  { commands: ['SUBMIT_REVIEW'], required: [], forbidden: ['targetVersionNumber', 'reasonCode', 'content', 'reviewDecision', 'reviewNote', 'schedule', 'scheduledPublishTaskId'] },
  { commands: ['REVIEW_FIRST', 'REVIEW_FINAL'], required: ['reviewDecision'], forbidden: ['targetVersionNumber', 'reasonCode', 'content', 'schedule', 'scheduledPublishTaskId'] },
  { commands: ['PUBLISH'], required: ['targetVersionNumber'], forbidden: ['reasonCode', 'content', 'reviewDecision', 'reviewNote', 'schedule', 'scheduledPublishTaskId'] },
  { commands: ['SCHEDULE_PUBLISH'], required: ['schedule'], forbidden: ['targetVersionNumber', 'reasonCode', 'content', 'reviewDecision', 'reviewNote', 'scheduledPublishTaskId'] },
  { commands: ['CANCEL_SCHEDULED_PUBLISH'], required: ['scheduledPublishTaskId'], forbidden: ['targetVersionNumber', 'content', 'reviewDecision', 'reviewNote', 'schedule'] },
  { commands: ['UNPUBLISH'], required: ['reasonCode'], forbidden: ['targetVersionNumber', 'content', 'reviewDecision', 'reviewNote', 'schedule', 'scheduledPublishTaskId'] },
  { commands: ['ROLLBACK'], required: ['targetVersionNumber', 'reasonCode'], forbidden: ['content', 'reviewDecision', 'reviewNote', 'schedule', 'scheduledPublishTaskId'] },
];
const ACTOR_CLASSES = [
  { name: 'EDITOR', commands: ['CREATE_DRAFT', 'SAVE_DRAFT', 'VALIDATE_DRAFT', 'SUBMIT_REVIEW'], separation: ['CANNOT_REVIEW_OWN_SUBMISSION', 'CANNOT_RELEASE_OWN_SUBMISSION'] },
  { name: 'FIRST_REVIEWER', commands: ['REVIEW_FIRST'], separation: ['MUST_DIFFER_FROM_EDITOR', 'MUST_DIFFER_FROM_FINAL_REVIEWER', 'CANNOT_RELEASE_OWN_REVIEW'] },
  { name: 'FINAL_REVIEWER', commands: ['REVIEW_FINAL'], separation: ['MUST_DIFFER_FROM_EDITOR', 'MUST_DIFFER_FROM_FIRST_REVIEWER', 'CANNOT_RELEASE_OWN_REVIEW'] },
  { name: 'RELEASE_OPERATOR', commands: ['PUBLISH', 'SCHEDULE_PUBLISH', 'CANCEL_SCHEDULED_PUBLISH', 'UNPUBLISH', 'ROLLBACK'], separation: ['MUST_DIFFER_FROM_EDITOR', 'MUST_DIFFER_FROM_FIRST_REVIEWER', 'MUST_DIFFER_FROM_FINAL_REVIEWER'] },
];
const REVIEW_WORKFLOW = {
  contentBindingFields: ['contentVersionId', 'contentHash'],
  stageOrder: ['FIRST_REVIEW', 'FINAL_REVIEW'],
  clientStageOrActorFacts: 'PROHIBITED',
  reviewFirstRequiredFacts: ['VALIDATION_REPORT_PASS', 'CONTENT_HASH_MATCH', 'EDITOR_DISTINCT', 'REVIEW_VERSION_CURRENT'],
  reviewFinalRequiredFacts: ['FIRST_REVIEW_APPROVED', 'CONTENT_HASH_MATCH', 'EDITOR_DISTINCT', 'FIRST_REVIEWER_DISTINCT', 'REVIEW_VERSION_CURRENT'],
  protectedContentMutation: 'INVALIDATE_VALIDATION_AND_REVIEWS',
  recordProjection: REVIEW_RECORD_POLICY,
};
const PUBLISH_ELIGIBILITY = {
  owner: 'content-service',
  clientFactSubmission: 'PROHIBITED',
  bindingFields: ['contentVersionId', 'contentHash', 'expectedStateVersion'],
  requiredFacts: [
    { name: 'VALIDATION_REPORT', requiredFields: ['reportId', 'reportVersion', 'contentHash'], decision: 'PASS' },
    { name: 'FIRST_REVIEW', requiredFields: ['reviewVersion', 'contentHash'], decision: 'APPROVED' },
    { name: 'FINAL_REVIEW', requiredFields: ['reviewVersion', 'contentHash'], decision: 'APPROVED' },
    { name: 'RIGHTS_SNAPSHOT', requiredFields: ['snapshotId', 'snapshotVersion'], decision: 'VALID' },
    { name: 'MEDIA', requiredFields: [], decision: 'READY' },
    { name: 'PHASE_FEATURE_GATE', requiredFields: [], decision: 'ALLOW' },
  ],
  actorFactFields: ['editorSubjectId', 'firstReviewerSubjectId', 'finalReviewerSubjectId', 'releaseOperatorSubjectId'],
  actorSeparation: 'ALL_FOUR_DISTINCT',
  protectedContentMutation: 'INVALIDATE_VALIDATION_AND_REVIEWS',
  scheduleExecution: 'RECHECK_ALL_REQUIRED_FACTS',
};
const INTERNAL_RETIREMENT = {
  externalCommand: 'PROHIBITED',
  handlerOwner: 'content-service',
  callerIdentity: 'B8WorkloadIdentity',
  externalExposure: 'DENY',
  fromStates: ['PUBLISHED'],
  terminalState: 'ARCHIVED',
  allowedReasons: ['RETENTION_EXPIRED', 'RIGHTS_PERMANENTLY_REMOVED', 'SECURITY_PERMANENTLY_REMOVED', 'LEGAL_PERMANENTLY_REMOVED'],
  currentPublicationPrecondition: 'MUST_NOT_REFERENCE_TARGET_VERSION',
  rollbackEligibilityPrecondition: 'MUST_NOT_BE_ROLLBACK_TARGET',
  activePinPrecondition: 'NO_ACTIVE_PIN_OR_ALL_PINS_EXPLICIT_UNAVAILABLE_EMERGENCY',
  recovery: 'PROHIBITED',
  idempotencyScope: 'contentVersionId+expectedStateVersion+retirementReason',
  correlationFields: ['retirementId', 'auditId', 'requestId', 'traceId', 'contentVersionId', 'stateVersion'],
  canonicalEvent: 'NONE',
  implementationTask: 'P1R-M3-006',
  runtimeEvidenceTask: 'P1R-M2-004',
};
const B10_PIN_SCOPE_POLICY = {
  usage: 'FUTURE_READ_OR_UNSTARTED_TASK',
  safeFallback: 'ALLOWED_BEFORE_SESSION_OR_ATTEMPT_START_ONLY',
  activeReplacement: 'PROHIBITED',
  recoveredIdentity: 'FULL_IMMUTABLE_FALLBACK',
  permanentRemovalRecovery: 'PROHIBITED',
};
const B10_FUTURE_PIN_REQUIRED = [
  'contentCode', 'contentVersionId', 'contentEpoch', 'snapshotId', 'snapshotHash', 'pinStatus', 'pinnedAt',
];
const B10_FUTURE_PIN_PROPERTIES = {
  contentCode: { $ref: '#/components/schemas/B10ContentCode' },
  contentVersionId: { $ref: '#/components/schemas/B10Int64Id' },
  contentEpoch: { $ref: '#/components/schemas/B10ContentEpoch' },
  snapshotId: { $ref: '#/components/schemas/B10SnapshotId' },
  snapshotHash: { $ref: '#/components/schemas/B10Sha256' },
  pinStatus: { type: 'string', enum: ['PINNED', 'UNPUBLISHED', 'RECOVERABLE', 'RECOVERED', 'UNAVAILABLE'] },
  pinnedAt: { $ref: '#/components/schemas/B10DateTime' },
  fallbackVersionId: { $ref: '#/components/schemas/B10Int64Id' },
  fallbackContentEpoch: { $ref: '#/components/schemas/B10ContentEpoch' },
  fallbackSnapshotId: { $ref: '#/components/schemas/B10SnapshotId' },
  fallbackSnapshotHash: { $ref: '#/components/schemas/B10Sha256' },
  recoveryReasonCode: { type: 'string', enum: ['NONE', 'CONTENT_UNPUBLISHED', 'RIGHTS_EXPIRED', 'SNAPSHOT_MISSING', 'POLICY_DENIED', 'SERVICE_DEGRADED', 'RIGHTS_REMOVED', 'SECURITY_REMOVED', 'LEGAL_REMOVED'] },
};
const B10_FUTURE_FALLBACK_DENIAL = {
  anyOf: [
    { required: ['fallbackVersionId'] },
    { required: ['fallbackContentEpoch'] },
    { required: ['fallbackSnapshotId'] },
    { required: ['fallbackSnapshotHash'] },
  ],
};
const B10_FUTURE_PIN_ONE_OF = [
  {
    properties: {
      pinStatus: { type: 'string', enum: ['PINNED'] },
      recoveryReasonCode: { type: 'string', enum: ['NONE'] },
    },
    required: ['recoveryReasonCode'],
    not: B10_FUTURE_FALLBACK_DENIAL,
  },
  {
    properties: {
      pinStatus: { type: 'string', enum: ['UNPUBLISHED'] },
      recoveryReasonCode: { type: 'string', enum: ['CONTENT_UNPUBLISHED'] },
    },
    required: ['recoveryReasonCode'],
    not: B10_FUTURE_FALLBACK_DENIAL,
  },
  {
    properties: {
      pinStatus: { type: 'string', enum: ['RECOVERABLE'] },
      recoveryReasonCode: { type: 'string', enum: ['CONTENT_UNPUBLISHED', 'RIGHTS_EXPIRED', 'SNAPSHOT_MISSING', 'POLICY_DENIED', 'SERVICE_DEGRADED'] },
    },
    required: ['recoveryReasonCode'],
    not: B10_FUTURE_FALLBACK_DENIAL,
  },
  {
    properties: {
      pinStatus: { type: 'string', enum: ['RECOVERED'] },
      recoveryReasonCode: { type: 'string', enum: ['CONTENT_UNPUBLISHED', 'RIGHTS_EXPIRED', 'SNAPSHOT_MISSING', 'POLICY_DENIED', 'SERVICE_DEGRADED'] },
    },
    required: ['recoveryReasonCode', 'fallbackVersionId', 'fallbackContentEpoch', 'fallbackSnapshotId', 'fallbackSnapshotHash'],
  },
  {
    properties: {
      pinStatus: { type: 'string', enum: ['UNAVAILABLE'] },
      recoveryReasonCode: { type: 'string', enum: ['RIGHTS_REMOVED', 'SECURITY_REMOVED', 'LEGAL_REMOVED'] },
    },
    required: ['recoveryReasonCode'],
    not: B10_FUTURE_FALLBACK_DENIAL,
  },
];
const B10_ACTIVE_PIN_POLICY = {
  usage: 'ACTIVE_SESSION_OR_ATTEMPT',
  versionIdentity: 'IMMUTABLE',
  allowedOutcomes: ['AVAILABLE', 'UNAVAILABLE'],
  safeFutureFallback: 'PROHIBITED',
  silentReplacement: 'PROHIBITED',
};
const B10_ACTIVE_PIN_REQUIRED = [
  'contentCode', 'contentVersionId', 'contentEpoch', 'snapshotId', 'snapshotHash', 'status', 'pinnedAt',
];
const B10_ACTIVE_PIN_PROPERTIES = {
  contentCode: { $ref: '#/components/schemas/B10ContentCode' },
  contentVersionId: { $ref: '#/components/schemas/B10Int64Id' },
  contentEpoch: { $ref: '#/components/schemas/B10ContentEpoch' },
  snapshotId: { $ref: '#/components/schemas/B10SnapshotId' },
  snapshotHash: { $ref: '#/components/schemas/B10Sha256' },
  status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE'] },
  pinnedAt: { $ref: '#/components/schemas/B10DateTime' },
  reasonCode: { type: 'string', enum: ['RIGHTS_REMOVED', 'SECURITY_REMOVED', 'LEGAL_REMOVED'] },
  alternativeAction: { type: 'string', enum: ['RETURN_TO_CATALOG', 'SELECT_ALTERNATIVE_TASK', 'CONTACT_SUPPORT'] },
  alternativeContentVersionId: { $ref: '#/components/schemas/B10Int64Id' },
};
const B10_ACTIVE_PIN_ONE_OF = [
  {
    properties: { status: { type: 'string', enum: ['AVAILABLE'] } },
    required: ['status'],
    not: { anyOf: [{ required: ['reasonCode'] }, { required: ['alternativeAction'] }, { required: ['alternativeContentVersionId'] }] },
  },
  {
    properties: { status: { type: 'string', enum: ['UNAVAILABLE'] } },
    required: ['status', 'reasonCode', 'alternativeAction'],
  },
];
const B10_RECOVERY_SCOPE_POLICY = {
  routeUsage: 'FUTURE_READ_ONLY',
  activeSessionOrAttempt: 'PROHIBITED',
  historicalRegrade: 'PROHIBITED',
};
const B10_RECOVERY_ONE_OF = [
  {
    properties: { resolution: { type: 'string', enum: ['EXACT_PIN'] } },
    required: ['resolvedVersionId', 'resolvedSnapshotId'],
  },
  {
    properties: { resolution: { type: 'string', enum: ['IMMUTABLE_SNAPSHOT'] } },
    required: ['resolvedSnapshotId'],
    not: { required: ['resolvedVersionId'] },
  },
  {
    properties: { resolution: { type: 'string', enum: ['SAFE_FUTURE_FALLBACK'] } },
    required: ['resolvedVersionId', 'resolvedSnapshotId'],
  },
  {
    properties: {
      resolution: { type: 'string', enum: ['UNAVAILABLE'] },
      recoveryReasonCode: { type: 'string', enum: ['CONTENT_UNPUBLISHED', 'RIGHTS_EXPIRED', 'SNAPSHOT_MISSING', 'POLICY_DENIED', 'SERVICE_DEGRADED', 'RIGHTS_REMOVED', 'SECURITY_REMOVED', 'LEGAL_REMOVED'] },
    },
    required: ['recoveryReasonCode'],
    not: { anyOf: [{ required: ['resolvedVersionId'] }, { required: ['resolvedSnapshotId'] }] },
  },
];
const SCHEDULE = {
  states: ['SCHEDULED', 'CANCELLED', 'EXECUTED', 'INVALIDATED', 'RECOVERY_REQUIRED'],
  clock: { scheduledAt: 'UTC_INSTANT', displayTimeZone: 'IANA_TIME_ZONE', dueCheck: 'SERVER_OWNED_CLOCK' },
  bindingFields: ['contentVersionId', 'contentHash', 'validationReportId', 'validationReportVersion', 'firstReviewVersion', 'finalReviewVersion', 'rightsSnapshotId', 'rightsSnapshotVersion', 'scheduledAt', 'displayTimeZone'],
  idempotency: { key: 'Idempotency-Key', scope: 'contentVersionId+scheduledAt+command', duplicate: 'RETURN_ORIGINAL_TASK' },
  dueRecheck: { required: ['CONTENT_HASH', 'VALIDATION_REPORT', 'FIRST_REVIEW', 'FINAL_REVIEW', 'RIGHTS_SNAPSHOT', 'MEDIA', 'PHASE_FEATURE_GATE', 'EXPECTED_STATE_VERSION'], onFailure: 'INVALIDATED_OR_RECOVERY_REQUIRED', directForeignWrite: 'PROHIBITED' },
  recovery: { taskId: 'P1R-M1-007', owner: 'workflow-service', mode: 'SAGA_COMPENSATION_AND_MANUAL_RECOVERY', directDomainWrite: 'PROHIBITED' },
};
const B9_TASK_STATE_FIELD_POLICY = {
  SCHEDULED: { required: [], forbidden: ['completedAt', 'failureCode', 'recoveryTaskId'] },
  CANCELLED: { required: ['completedAt'], forbidden: ['recoveryTaskId'] },
  EXECUTED: { required: ['completedAt'], forbidden: ['failureCode', 'recoveryTaskId'] },
  INVALIDATED: { required: ['failureCode', 'completedAt'], forbidden: ['recoveryTaskId'] },
  RECOVERY_REQUIRED: { required: ['failureCode', 'recoveryTaskId'], forbidden: [] },
};
const B9_TASK_ONE_OF = SCHEDULE.states.map(function (status) {
  return { status, ...B9_TASK_STATE_FIELD_POLICY[status] };
});
const PROJECTION = {
  allowLists: [
    {
      audience: 'PUBLIC', fieldSet: 'PUBLIC_V1', schemaRef: '#/components/schemas/B9PublicContentProjection',
      allowedFields: ['projectionKey', 'contentCode', 'contentType', 'title', 'summary', 'contentLocale', 'targetLevel', 'contentVersionId', 'versionNumber', 'projectionVersion', 'contentEpoch', 'availability', 'projectionStatus', 'items', 'publishedAt', 'cacheTag'],
      requiredFields: ['projectionKey', 'contentCode', 'contentType', 'title', 'contentLocale', 'targetLevel', 'contentVersionId', 'versionNumber', 'projectionVersion', 'contentEpoch', 'availability', 'items', 'publishedAt', 'cacheTag'],
      forbiddenFields: ['answerRuleVersion', 'answerRuleBody', 'draftPayload', 'reviewerActors', 'sourceLicenseEvidence', 'rightsEvidence', 'scheduledPublishTask'],
      versionPin: 'EXACT_OR_NOT_FOUND', staleEpoch: 'REJECT',
    },
    {
      audience: 'LEARNER', fieldSet: 'LEARNER_V1', schemaRef: '#/components/schemas/B9LearnerContentProjection',
      allowedFields: ['content', 'learnerAccess', 'contentEpoch', 'projectionStatus', 'sessionPin'],
      requiredFields: ['content', 'learnerAccess', 'contentEpoch'],
      forbiddenFields: ['answerRuleVersion', 'answerRuleBody', 'draftPayload', 'reviewerActors', 'sourceLicenseEvidence', 'rightsEvidence', 'scheduledPublishTask'],
      versionPin: 'EXACT_OR_NOT_FOUND', staleEpoch: 'REJECT',
    },
    {
      audience: 'ASSESSMENT', fieldSet: 'ASSESSMENT_SNAPSHOT_V1', schemaRef: '#/components/schemas/B9AssessmentContentSnapshot',
      allowedFields: ['contentVersionId', 'contentCode', 'snapshotVersion', 'items', 'rightsStatus', 'expiresAt'],
      requiredFields: ['contentVersionId', 'contentCode', 'snapshotVersion', 'items', 'rightsStatus'],
      forbiddenFields: ['answerRuleBody', 'draftPayload', 'reviewerActors', 'sourceLicenseEvidence', 'rightsEvidence', 'scheduledPublishTask'],
      opaqueReferenceFields: ['answerRuleVersion', 'scoringPolicyRef'], exposure: 'INTERNAL_VERSIONED_SNAPSHOT', externalProjection: false,
      versionPin: 'EXACT_OR_NOT_FOUND', staleEpoch: 'REJECT',
    },
  ],
  versionPin: {
    source: 'contentVersionId+versionNumber', fallback: 'PROHIBITED',
    sessionPin: { field: 'contentVersionId', binding: 'SESSION_START', mutation: 'PROHIBITED' },
    emergencyRemoval: {
      reasons: ['RIGHTS_REMOVED', 'SECURITY_REMOVED', 'LEGAL_REMOVED'], result: 'UNAVAILABLE',
      requiredFields: ['reasonCode', 'alternativeAction'], silentFallback: 'PROHIBITED',
    },
  },
  epoch: { field: 'contentEpoch', projectionVersionField: 'projectionVersion', consumerRule: 'REJECT_OLDER_OR_CROSS_VERSION' },
  responseStatus: { field: 'projectionStatus', enum: ['CURRENT', 'STALE', 'PROCESSING'], default: 'CURRENT', publishedOnly: true },
  correlation: {
    fields: ['commandId', 'taskId', 'auditId', 'requestId', 'traceId', 'contentVersionId', 'contentHash', 'stateVersion'],
    serverDerived: ['commandId', 'taskId', 'auditId', 'requestId', 'traceId', 'stateVersion'],
  },
};
const LEGACY_B1 = {
  contractPath: B1_OPENAPI_PATH, disposition: 'HISTORICAL_COMPATIBILITY_ONLY',
  newV2Write: 'PROHIBITED', clientAuthorityHeaders: 'PROHIBITED', migration: 'USE_B9_CONTENT_COMMANDS',
  authorityInputsIgnored: ['actorId', 'reviewerId', 'X-Content-Role'],
  deprecatedLifecycleWrites: [
    { method: 'POST', route: '/api/v1/content', operationId: 'createContentEntity' },
    { method: 'POST', route: '/api/v1/content/{contentId}/versions', operationId: 'createContentVersion' },
    { method: 'POST', route: '/api/v1/content/{contentId}/versions/{versionId}/submit', operationId: 'submitContentVersion' },
    { method: 'POST', route: '/api/v1/content/{contentId}/versions/{versionId}/review', operationId: 'decideContentVersionReview' },
    { method: 'POST', route: '/api/v1/content/{contentId}/versions/{versionId}/publish', operationId: 'publishContentVersion' },
    { method: 'POST', route: '/api/v1/content/{contentId}/versions/{versionId}/archive', operationId: 'archiveContentVersion' },
    { method: 'POST', route: '/api/v1/content/{contentId}/versions/{versionId}/restore', operationId: 'restoreContentVersion' },
    { method: 'POST', route: '/api/v1/content/imports', operationId: 'importContentBatch' },
  ],
};
const COMPATIBILITY_PROMOTION = {
  sourceContractBaseline: '6ce98a95b75e7efca05cc511f5f773dbf2be08a4',
  immutableGovernanceBaseline: '868c2177f62b6d2cf613bed702686dddcfe6943f',
  fromStatus: 'HISTORICAL_CANDIDATE', toStatus: 'CANONICAL_D2',
  eventNames: CANONICAL_CONTENT_EVENTS,
  gapIds: ['EVENT-GAP-CONTENT-DUPLICATE', 'EVENT-GAP-BIND-CONT-001'],
  topic: 'platform.content.v1',
  addedConsumerGroups: ['cg.admin-ops-from-content.v1', 'cg.audit-from-content.v1'],
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
};
const POLICY_KEYS = [
  '$schema', 'schemaVersion', 'taskId', 'phase', 'maturity', 'runtimeStatus',
  'sourceOfTruth', 'sourceRefs', 'owner', 'persistentVersionStates', 'reviewStages',
  'legacyWireAliases', 'commands', 'actorClasses', 'reviewWorkflow', 'publishEligibility',
  'internalRetirement', 'schedule', 'projection',
  'legacyB1', 'eventGovernance', 'plannedClosureDisposition', 'runtimeEvidenceBoundary',
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (isRecord(value)) return '{' + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ':' + stableJson(value[key]);
  }).join(',') + '}';
  return JSON.stringify(value);
}

function stableSha256(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function exact(errors, actual, expected, label) {
  add(errors, stableJson(actual) === stableJson(expected), label + ' drifted from the frozen P1R-M1-008 policy');
}

function exactKeys(errors, value, expected, label) {
  add(errors, isRecord(value), label + ' must be an object');
  if (isRecord(value)) exact(errors, Object.keys(value).sort(), expected.slice().sort(), label + ' keys');
}

function singletonEnumValue(value) {
  return isRecord(value) && Array.isArray(value.enum) && value.enum.length === 1 ? value.enum[0] : undefined;
}

function findKeywordLocations(value, keyword, location = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach(function (item, index) { findKeywordLocations(item, keyword, location + '[' + index + ']', found); });
    return found;
  }
  if (!isRecord(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const itemLocation = location + '.' + key;
    if (key === keyword) found.push(itemLocation);
    findKeywordLocations(child, keyword, itemLocation, found);
  }
  return found;
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8'));
}

function eventByName(catalog, eventName) {
  return (catalog.events || []).find(function (event) { return event && event.eventName === eventName; });
}

function resolvePointer(document, reference) {
  if (typeof reference !== 'string' || !reference.startsWith('#/')) return undefined;
  return reference.slice(2).split('/').reduce(function (current, token) {
    return current && current[token.replaceAll('~1', '/').replaceAll('~0', '~')];
  }, document);
}

function schema(document, name) {
  return document && document.components && document.components.schemas && document.components.schemas[name];
}

function resolveInlineOrLocalSchema(primaryDocument, secondaryDocument, value) {
  if (!isRecord(value)) return undefined;
  if (typeof value.$ref !== 'string') return value;
  return resolvePointer(primaryDocument, value.$ref) || resolvePointer(secondaryDocument, value.$ref);
}

function hasForbiddenProjectionField(document, source, forbiddenFields, seenReferences = new Set(), seenObjects = new Set()) {
  if (!isRecord(source) || seenObjects.has(source)) return false;
  seenObjects.add(source);
  if (typeof source.$ref === 'string') {
    if (seenReferences.has(source.$ref)) return false;
    seenReferences.add(source.$ref);
    return hasForbiddenProjectionField(document, resolvePointer(document, source.$ref), forbiddenFields, seenReferences, seenObjects);
  }
  for (const [field, fieldSchema] of Object.entries(source.properties || {})) {
    if (forbiddenFields.includes(field)) return true;
    if (hasForbiddenProjectionField(document, fieldSchema, forbiddenFields, seenReferences, seenObjects)) return true;
  }
  for (const key of ['items', 'not']) {
    if (hasForbiddenProjectionField(document, source[key], forbiddenFields, seenReferences, seenObjects)) return true;
  }
  for (const key of ['allOf', 'anyOf', 'oneOf']) {
    for (const item of source[key] || []) {
      if (hasForbiddenProjectionField(document, item, forbiddenFields, seenReferences, seenObjects)) return true;
    }
  }
  return false;
}

function commandNamesFromBranch(branch) {
  const discriminator = branch && branch.properties && branch.properties.command;
  if (!isRecord(discriminator)) return [];
  if (Array.isArray(discriminator.enum) && Object.keys(discriminator).length === 1 && discriminator.enum.every(function (item) { return typeof item === 'string'; })) return discriminator.enum.slice();
  return [];
}

function exactForbiddenConstraint(errors, actual, forbidden, label) {
  if (forbidden.length === 0) {
    add(errors, actual === undefined, label + ' must not declare a forbidden-field bypass');
    return;
  }
  const expected = forbidden.length === 1
    ? { required: forbidden }
    : { anyOf: forbidden.map(function (field) { return { required: [field] }; }) };
  exact(errors, actual, expected, label);
}

function checkCommandOneOf(request, errors) {
  const branches = request && request.oneOf;
  add(errors, Array.isArray(branches) && branches.length === B9_COMMAND_ONE_OF.length, 'B9 command oneOf must contain exactly nine closed discriminator branches');
  if (!Array.isArray(branches)) return;
  const coveredCommands = [];
  for (const [index, branch] of branches.entries()) {
    const commands = commandNamesFromBranch(branch);
    const spec = B9_COMMAND_ONE_OF.find(function (candidate) { return stableJson(candidate.commands) === stableJson(commands); });
    const label = 'B9 command oneOf branch ' + (commands.join('+') || '#' + index);
    add(errors, spec !== undefined, label + ' must have a frozen command discriminator');
    coveredCommands.push(...commands);
    if (!spec || !isRecord(branch)) continue;
    exactKeys(errors, branch, ['properties', ...(spec.required.length > 0 ? ['required'] : []), 'not'], label);
    const expectedDiscriminator = { command: { enum: spec.commands } };
    exact(errors, branch.properties, expectedDiscriminator, label + ' discriminator');
    exact(errors, branch.required || [], spec.required, label + ' required fields');
    exactForbiddenConstraint(errors, branch.not, spec.forbidden, label + ' forbidden fields');
  }
  const expectedCommands = COMMANDS.map(function (command) { return command.name; }).sort();
  exact(errors, coveredCommands.slice().sort(), expectedCommands, 'B9 command oneOf discriminator coverage');
  add(errors, new Set(coveredCommands).size === coveredCommands.length, 'B9 command oneOf must not duplicate a command discriminator');
}

function checkScheduledTaskOneOf(task, errors) {
  const branches = task && task.oneOf;
  add(errors, Array.isArray(branches) && branches.length === B9_TASK_ONE_OF.length, 'B9 scheduled task oneOf must contain exactly five closed status branches');
  if (!Array.isArray(branches)) return;
  const coveredStatuses = [];
  for (const [index, branch] of branches.entries()) {
    const status = singletonEnumValue(branch && branch.properties && branch.properties.status);
    const spec = B9_TASK_ONE_OF.find(function (candidate) { return candidate.status === status; });
    const label = 'B9 scheduled task oneOf branch ' + (status || '#' + index);
    add(errors, spec !== undefined, label + ' must have a frozen task-status discriminator');
    if (typeof status === 'string') coveredStatuses.push(status);
    if (!spec || !isRecord(branch)) continue;
    exactKeys(errors, branch, ['properties', ...(spec.required.length > 0 ? ['required'] : []), ...(spec.forbidden.length > 0 ? ['not'] : [])], label);
    exact(errors, branch.properties, { status: { enum: [spec.status] } }, label + ' discriminator');
    exact(errors, branch.required || [], spec.required, label + ' required fields');
    exactForbiddenConstraint(errors, branch.not, spec.forbidden, label + ' forbidden fields');
  }
  exact(errors, coveredStatuses.slice().sort(), SCHEDULE.states.slice().sort(), 'B9 scheduled task oneOf status coverage');
  add(errors, new Set(coveredStatuses).size === coveredStatuses.length, 'B9 scheduled task oneOf must not duplicate a status discriminator');
}

function checkPolicy(policy, errors) {
  exactKeys(errors, policy, POLICY_KEYS, 'content lifecycle policy');
  if (!isRecord(policy)) return;
  add(errors, policy.$schema === 'p1r.content-lifecycle.v1' && policy.schemaVersion === 'p1r.content-lifecycle.v1', 'content lifecycle policy identity is invalid');
  add(errors, policy.taskId === 'P1R-M1-008' && policy.phase === 'PHASE_1', 'content lifecycle task or phase is invalid');
  add(errors, policy.maturity === 'D2_CONTRACT_READY' && policy.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'content lifecycle must remain D2 and NOT_RUNTIME_VERIFIED');
  add(errors, policy.sourceOfTruth === DEFAULT_CONTENT_LIFECYCLE_POLICY, 'content lifecycle sourceOfTruth is invalid');
  exact(errors, policy.sourceRefs, ['JNY-P1-13', 'INT-P1-005', 'INT-P1-011', 'ADM-0493-ADM-0540', 'docs/06-design/v2-980plus/phase1-business-operation/README.md', B9_OPENAPI_PATH], 'content lifecycle sourceRefs');
  exact(errors, policy.owner, {
    service: 'content-service', dataOwner: 'content-service', gatewayDomainWrite: 'PROHIBITED',
    foreignSchemaWrite: 'PROHIBITED', actorContext: 'SERVER_DERIVED', clientRoleHeader: 'PROHIBITED',
  }, 'content lifecycle owner boundary');
  exact(errors, policy.persistentVersionStates, PERSISTENT_STATES, 'persistent content-version states');
  exact(errors, policy.reviewStages, REVIEW_STAGES, 'review stage names');
  exact(errors, policy.legacyWireAliases, [
    { wireState: 'UNPUBLISHED', semantic: 'PUBLICATION_POINTER_UNAVAILABLE', persistentVersionState: 'PUBLISHED' },
    { wireState: 'ROLLED_BACK', semantic: 'PUBLICATION_POINTER_REPOINTED', persistentVersionState: 'PUBLISHED' },
  ], 'legacy wire aliases');
  exact(errors, policy.commands, COMMANDS, 'content command state machine');
  exact(errors, policy.actorClasses, ACTOR_CLASSES, 'four content actor classes');
  exact(errors, policy.reviewWorkflow, REVIEW_WORKFLOW, 'content review workflow');
  exact(errors, policy.publishEligibility, PUBLISH_ELIGIBILITY, 'content publish eligibility');
  exact(errors, policy.internalRetirement, INTERNAL_RETIREMENT, 'content internal retirement');
  exact(errors, policy.schedule, SCHEDULE, 'content scheduling policy');
  exact(errors, policy.projection, PROJECTION, 'content projection policy');
  exact(errors, policy.legacyB1, LEGACY_B1, 'legacy B1 disposition');
  exact(errors, policy.eventGovernance, {
    catalogPath: 'packages/contracts/events/v1/catalog.json',
    b26Path: 'config/b26-event-runtime.json',
    reliabilityPolicyPath: 'packages/contracts/events/v1/reliability-policy.json',
    canonicalEvents: CANONICAL_CONTENT_EVENTS,
    historicalOnlyEvents: HISTORICAL_CONTENT_EVENTS,
    canonicalTopic: 'platform.content.v1',
    canonicalProducer: 'content-service',
    canonicalEnvelope: CANONICAL_ENVELOPE,
    canonicalRuntimeStatus: 'NOT_RUNTIME_VERIFIED',
    compatibilityPromotion: COMPATIBILITY_PROMOTION,
  }, 'content event governance policy');
  exact(errors, policy.plannedClosureDisposition, [
    {
      gapId: 'EVENT-GAP-CONTENT-DUPLICATE',
      status: 'D2_CONTRACT_CLOSED',
      closureTask: 'P1R-M1-008',
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      remainingRuntimeTasks: ['P1R-M2-005', 'P1R-M2-006'],
    },
    {
      gapId: 'EVENT-GAP-BIND-CONT-001',
      status: 'D2_CONTRACT_CLOSED',
      closureTask: 'P1R-M1-008',
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      remainingRuntimeTasks: ['P1R-M2-005', 'P1R-M2-006'],
    },
  ], 'content D2 planned-closure disposition');
  exact(errors, policy.runtimeEvidenceBoundary, {
    staticOnly: true,
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    b26: { mode: 'static-only', runtimeStatus: 'pending', defaultDecision: 'NO-GO' },
    pendingEvidence: ['CONTENT_OUTBOX_DELIVERY', 'SCHEDULE_DUE_RECHECK', 'PROJECTION_REPLAY', 'ROLE_SEPARATION_AUTHORIZATION'],
  }, 'content lifecycle runtime evidence boundary');
  scanRuntimePromotion(policy, '$', errors);
}

function scanRuntimePromotion(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach(function (item, index) { scanRuntimePromotion(item, location + '[' + index + ']', errors); });
    return;
  }
  if (!isRecord(value)) return;
  const allowed = new Set([
    '$.runtimeStatus',
    '$.eventGovernance.canonicalRuntimeStatus',
    '$.eventGovernance.compatibilityPromotion.runtimeStatus',
    '$.reviewWorkflow.recordProjection.runtimeStatus',
    '$.plannedClosureDisposition[0].runtimeStatus',
    '$.plannedClosureDisposition[1].runtimeStatus',
    '$.internalRetirement.runtimeEvidenceTask',
    '$.runtimeEvidenceBoundary',
    '$.runtimeEvidenceBoundary.runtimeStatus',
    '$.runtimeEvidenceBoundary.b26.runtimeStatus',
  ]);
  for (const [key, item] of Object.entries(value)) {
    const itemLocation = location + '.' + key;
    const normalized = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
    const isDeclaredRuntimeBoundary = allowed.has(itemLocation) || /^\$\.plannedClosureDisposition\[\d+\]\.remainingRuntimeTasks$/.test(itemLocation);
    if (/(runtime|attestation|verification|proof|certified|deployed|operational|live|current status)/.test(normalized) && !isDeclaredRuntimeBoundary) {
      errors.push(itemLocation + ' is an unknown runtime proof, promotion, or verification field');
    }
    scanRuntimePromotion(item, itemLocation, errors);
  }
}

function checkB9(policy, b9, b9Shared, catalog, errors) {
  add(errors, findKeywordLocations(b9, 'const').length === 0, 'B9 content OpenAPI 3.0.3 schemas must use singleton enum instead of unsupported const');
  const request = schema(b9, 'B9ContentCommandRequest');
  add(errors, request && request.additionalProperties === false, 'B9 content command request must be a closed object');
  const commandNames = (request && request.properties && request.properties.command && request.properties.command.enum) || [];
  exact(errors, commandNames.slice().sort(), COMMANDS.map(function (command) { return command.name; }).sort(), 'B9 content command enum');
  add(errors, !commandNames.includes('VALIDATE'), 'B9 must use VALIDATE_DRAFT rather than ambiguous VALIDATE');
  exact(errors, request && request.required, COMMAND_REQUEST_BASE_FIELDS, 'B9 content command base required fields');
  exact(errors, Object.keys(request && request.properties || {}), COMMAND_REQUEST_PROPERTIES, 'B9 content command property set');
  exact(errors, request && request['x-server-derived-authorization-facts'], ['actor', 'tenant', 'owner', 'role', 'permission', 'contentRights', 'reviewStage'], 'B9 server-derived authorization facts');
  for (const field of ['actorId', 'reviewerId', 'tenantId', 'ownerId', 'role', 'permission']) {
    add(errors, !(request && request.properties && Object.hasOwn(request.properties, field)), 'B9 command request must not accept client ' + field);
  }
  const fieldPolicy = request && request['x-command-field-policy'];
  add(errors, isRecord(fieldPolicy), 'B9 command field policy must be an object');
  exact(errors, fieldPolicy, B9_COMMAND_FIELD_POLICY, 'B9 command field policy');
  add(errors, fieldPolicy && Object.hasOwn(fieldPolicy, 'REVIEW_FIRST') && Object.hasOwn(fieldPolicy, 'REVIEW_FINAL'), 'B9 review commands must use REVIEW_FIRST and REVIEW_FINAL');
  add(errors, !(fieldPolicy && (Object.hasOwn(fieldPolicy, 'FIRST_REVIEW') || Object.hasOwn(fieldPolicy, 'FINAL_REVIEW'))), 'B9 review stages must not be used as command names');
  checkCommandOneOf(request, errors);

  for (const name of ['B9ContentVersionSummary', 'B9AdminContentState']) {
    const state = schema(b9, name);
    exact(errors, state && state['x-canonical-persistent-statuses'], PERSISTENT_STATES, name + ' canonical persistent states');
    exact(errors, state && state['x-deprecated-compatibility-statuses'], ['UNPUBLISHED', 'ROLLED_BACK'], name + ' legacy compatibility aliases');
  }
  const adminState = schema(b9, 'B9AdminContentState');
  add(errors, !(adminState && adminState.properties && Object.hasOwn(adminState.properties, 'reviewStages')), 'B9 admin content state must not retain legacy reviewStages aliases');
  const reviewRecords = adminState && adminState.properties && adminState.properties.reviewRecords;
  add(errors, reviewRecords && reviewRecords.type === 'array' && reviewRecords.readOnly === true, 'B9 admin reviewRecords must be a read-only array');
  add(errors, reviewRecords && reviewRecords.minItems === 0 && reviewRecords.maxItems === 2 && reviewRecords.uniqueItems === true, 'B9 admin reviewRecords must allow only empty, FIRST-only, or one FIRST plus one FINAL');
  exact(errors, reviewRecords && reviewRecords['x-p1r-review-records-policy'], REVIEW_RECORD_POLICY, 'B9 admin reviewRecords projection policy');
  exact(errors, reviewRecords && reviewRecords.oneOf, REVIEW_RECORD_ARRAY_BRANCHES, 'B9 admin reviewRecords allowed array shapes');
  const reviewRecord = resolveInlineOrLocalSchema(b9, b9Shared, reviewRecords && reviewRecords.items);
  add(errors, reviewRecord && reviewRecord.type === 'object' && reviewRecord.additionalProperties === false && reviewRecord.readOnly === true, 'B9 admin review record must be a closed read-only object');
  exact(errors, reviewRecord && reviewRecord.required, REVIEW_RECORD_FIELDS, 'B9 admin review record required fields');
  exact(errors, Object.keys(reviewRecord && reviewRecord.properties || {}), REVIEW_RECORD_FIELDS, 'B9 admin review record field set');
  exact(errors, reviewRecord && reviewRecord.oneOf, REVIEW_RECORD_STAGE_BRANCHES, 'B9 admin review record stage discriminator');
  const contentVersionId = reviewRecord && reviewRecord.properties && reviewRecord.properties.contentVersionId;
  const contentHash = reviewRecord && reviewRecord.properties && reviewRecord.properties.contentHash;
  const reviewStage = reviewRecord && reviewRecord.properties && reviewRecord.properties.reviewStage;
  const decision = reviewRecord && reviewRecord.properties && reviewRecord.properties.decision;
  const reviewVersion = reviewRecord && reviewRecord.properties && reviewRecord.properties.reviewVersion;
  const auditId = reviewRecord && reviewRecord.properties && reviewRecord.properties.auditId;
  const decidedAt = reviewRecord && reviewRecord.properties && reviewRecord.properties.decidedAt;
  add(errors, contentVersionId && contentVersionId.$ref === '#/components/schemas/B9ContentVersionId', 'B9 admin review record must bind contentVersionId');
  add(errors, contentHash && contentHash.type === 'string' && contentHash.pattern === '^[a-fA-F0-9]{64}$', 'B9 admin review record must bind the immutable contentHash');
  exact(errors, reviewStage && reviewStage.enum, REVIEW_STAGES, 'B9 admin review record reviewStage enum');
  add(errors, reviewStage && reviewStage.type === 'string', 'B9 admin review record reviewStage must be a string');
  exact(errors, decision && decision.enum, REVIEW_DECISIONS, 'B9 admin review record decision enum');
  add(errors, decision && decision.type === 'string', 'B9 admin review record decision must be a string');
  add(errors, reviewVersion && reviewVersion.type === 'integer' && reviewVersion.minimum === 1, 'B9 admin review record reviewVersion must be an integer with minimum one');
  add(errors, auditId && auditId.$ref === '#/components/schemas/B9AuditId', 'B9 admin review record must bind the audit ID');
  add(errors, decidedAt && decidedAt.$ref === '#/components/schemas/B9DateTime', 'B9 admin review record must bind decidedAt');

  const scheduleInput = schema(b9, 'B9PublishScheduleInput');
  add(errors, scheduleInput && scheduleInput.additionalProperties === false, 'B9 schedule input must be a closed object');
  exact(errors, scheduleInput && scheduleInput.required, SCHEDULE.bindingFields, 'B9 schedule binding fields');
  for (const forbidden of ['validationStatus', 'reviewStatus', 'rightsStatus']) {
    add(errors, !(scheduleInput && scheduleInput.properties && Object.hasOwn(scheduleInput.properties, forbidden)), 'B9 schedule must not accept client ' + forbidden + ' as an authority fact');
  }
  add(errors, scheduleInput && scheduleInput.properties && scheduleInput.properties.scheduledAt && scheduleInput.properties.scheduledAt.$ref === '#/components/schemas/B9OffsetDateTime', 'B9 schedule must use an offset UTC instant');
  add(errors, scheduleInput && scheduleInput.properties && scheduleInput.properties.displayTimeZone && scheduleInput.properties.displayTimeZone.$ref === '#/components/schemas/B9DisplayTimeZone', 'B9 schedule must use an IANA display time zone');
  const task = schema(b9, 'B9ScheduledPublishTask');
  add(errors, task && task.additionalProperties === false && task.readOnly === true, 'B9 scheduled publish task must be a closed read-only server projection');
  exact(errors, task && task.properties && task.properties.status && task.properties.status.enum, SCHEDULE.states, 'B9 scheduled task state machine');
  exact(errors, task && task['x-task-state-field-policy'], B9_TASK_STATE_FIELD_POLICY, 'B9 scheduled task state metadata');
  checkScheduledTaskOneOf(task, errors);
  for (const field of ['stateVersion', 'commandId', 'auditId']) {
    add(errors, (task && task.required || []).includes(field), 'B9 scheduled task must require ' + field);
  }
  add(errors, Array.isArray(task && task['x-server-generated-fields']) && task['x-server-generated-fields'].includes('recoveryTaskId'), 'B9 scheduled task must expose only a server-generated recovery reference');

  for (const definition of PROJECTION.allowLists) {
    const name = definition.schemaRef.split('/').at(-1);
    const projection = schema(b9, name);
    add(errors, projection && projection.additionalProperties === false, name + ' must be a closed projection schema');
    exact(errors, Object.keys(projection && projection.properties || {}), definition.allowedFields, name + ' projection allow-list fields');
    exact(errors, projection && projection.required, definition.requiredFields, name + ' projection required fields');
    add(errors, !hasForbiddenProjectionField(b9, projection, definition.forbiddenFields), name + ' must not expose draft, review, rights-evidence, scheduling, or answer-rule bodies');
  }

  for (const name of ['B9PublicContentProjection', 'B9LearnerContentProjection']) {
    const projection = schema(b9, name);
    const status = projection && projection.properties && projection.properties.projectionStatus;
    add(errors, (projection && projection.required || []).includes('projectionStatus') === false, name + ' projectionStatus must remain optional and additive');
    exact(errors, status && status.enum, ['CURRENT', 'STALE', 'PROCESSING'], name + ' projectionStatus enum');
    add(errors, status && status.default === 'CURRENT', name + ' projectionStatus default must be CURRENT');
    const publishedOnlyText = String(status && status.description || '') + ' ' + String(projection && projection.properties && projection.properties.availability && projection.properties.availability.description || '');
    add(errors, /published|已发布/.test(publishedOnlyText), name + ' projectionStatus description must state published-only behavior');
  }
  exact(errors, schema(b9, 'B9PublicContentProjection') && schema(b9, 'B9PublicContentProjection').properties && schema(b9, 'B9PublicContentProjection').properties.availability && schema(b9, 'B9PublicContentProjection').properties.availability.enum, ['PUBLISHED'], 'B9 public projection availability singleton enum');
  exact(errors, schema(b9, 'B9PublicContentCard') && schema(b9, 'B9PublicContentCard').properties && schema(b9, 'B9PublicContentCard').properties.availability && schema(b9, 'B9PublicContentCard').properties.availability.enum, ['PUBLISHED'], 'B9 public card availability singleton enum');

  const assessmentRoute = b9 && b9.paths && b9.paths['/internal/v1/content/versions/{contentVersionId}/assessment-snapshot'] && b9.paths['/internal/v1/content/versions/{contentVersionId}/assessment-snapshot'].get;
  add(errors, assessmentRoute && assessmentRoute.operationId === 'getB9AssessmentContentSnapshot', 'B9 assessment projection must remain the named internal snapshot operation');
  add(errors, assessmentRoute && assessmentRoute.security && assessmentRoute.security.some(function (item) { return isRecord(item) && Object.hasOwn(item, 'B8WorkloadIdentity'); }), 'B9 assessment snapshot must require workload identity');
  add(errors, assessmentRoute && assessmentRoute['x-contract'] && assessmentRoute['x-contract'].caller === 'assessment-service' && assessmentRoute['x-contract'].readOnly === true, 'B9 assessment snapshot must remain a read-only assessment-service internal contract');
  const assessmentItem = schema(b9, 'B9AssessmentItemDefinition');
  exact(errors, Object.keys(assessmentItem && assessmentItem.properties || {}), ['itemCode', 'itemType', 'stimulusRef', 'answerRuleVersion', 'scoringPolicyRef'], 'B9 assessment snapshot opaque item fields');
  add(errors, assessmentItem && assessmentItem.additionalProperties === false, 'B9 assessment snapshot item must remain closed');
  add(errors, !Object.hasOwn((assessmentItem && assessmentItem.properties) || {}, 'answerRuleBody'), 'B9 assessment snapshot must not expose an answer rule body');

  const versionPin = b9Shared && b9Shared.components && b9Shared.components.parameters && b9Shared.components.parameters.B9VersionPin;
  add(errors, versionPin && versionPin.in === 'query' && versionPin.required === false && versionPin.schema && versionPin.schema.$ref === '#/components/schemas/B9ContentVersionId', 'B9 versionPin must remain an optional content-version pin');
  add(errors, /不.*回退|rather than.*fallback/i.test(String(versionPin && versionPin.description || '')), 'B9 versionPin must prohibit fallback to another version');
  const sessionPin = schema(b9, 'B9SessionContentPin') || schema(b9Shared, 'B9SessionContentPin');
  const learnerProjection = schema(b9, 'B9LearnerContentProjection');
  add(errors, learnerProjection && learnerProjection.properties && learnerProjection.properties.sessionPin && learnerProjection.properties.sessionPin.$ref === '#/components/schemas/B9SessionContentPin', 'B9 learner projection must expose only the optional B9SessionContentPin session binding');
  add(errors, (learnerProjection && learnerProjection.required || []).includes('sessionPin') === false, 'B9 learner sessionPin must remain optional and additive');
  add(errors, sessionPin && sessionPin.readOnly === true && sessionPin.additionalProperties === false && (sessionPin.required || []).includes('status') && (sessionPin.required || []).includes('contentVersionId'), 'B9SessionContentPin must be a closed read-only contentVersionId binding');
  exact(errors, sessionPin && sessionPin.properties && sessionPin.properties.status && sessionPin.properties.status.enum, ['AVAILABLE', 'UNAVAILABLE'], 'B9SessionContentPin status enum');
  add(errors, /不得静默|must not silently|no silent fallback/i.test(String(sessionPin && sessionPin.description || '')), 'B9SessionContentPin must explicitly prohibit silent fallback');
  const pinAlternatives = (sessionPin && sessionPin.oneOf) || [];
  const availablePin = pinAlternatives.find(function (item) { return singletonEnumValue(item && item.properties && item.properties.status) === 'AVAILABLE'; });
  const unavailablePin = pinAlternatives.find(function (item) { return singletonEnumValue(item && item.properties && item.properties.status) === 'UNAVAILABLE'; });
  add(errors, pinAlternatives.length === 2 && availablePin && unavailablePin, 'B9SessionContentPin must have exactly AVAILABLE and UNAVAILABLE alternatives');
  add(errors, availablePin && !(availablePin.required || []).includes('reasonCode') && !(availablePin.required || []).includes('alternativeAction'), 'available B9SessionContentPin must not carry removal details');
  exact(errors, availablePin && availablePin.not && availablePin.not.anyOf && availablePin.not.anyOf.map(function (item) { return item && item.required && item.required[0]; }), ['reasonCode', 'alternativeAction', 'alternativeContentVersionId'], 'available B9SessionContentPin removal-detail denial');
  add(errors, unavailablePin && (unavailablePin.required || []).includes('reasonCode') && (unavailablePin.required || []).includes('alternativeAction'), 'unavailable B9SessionContentPin must expose reasonCode and alternativeAction');
  const unavailableReasons = unavailablePin && sessionPin && sessionPin.properties && sessionPin.properties.reasonCode && sessionPin.properties.reasonCode.enum;
  exact(errors, unavailableReasons, ['RIGHTS_REMOVED', 'SECURITY_REMOVED', 'LEGAL_REMOVED'], 'B9SessionContentPin emergency reason codes');
  for (const forbidden of ['content', 'rightsEvidence', 'rightsSnapshotId', 'draftPayload', 'answerRuleBody', 'fallbackContentVersionId']) {
    add(errors, !(sessionPin && sessionPin.properties && Object.hasOwn(sessionPin.properties, forbidden)), 'B9SessionContentPin must not expose ' + forbidden);
  }

  for (const field of PROJECTION.correlation.fields) {
    add(errors, task && task.properties && Object.hasOwn(task.properties, field) && (task.required || []).includes(field), 'B9 scheduled task must retain correlation field ' + field);
  }
  for (const field of PROJECTION.correlation.serverDerived) {
    add(errors, Array.isArray(task && task['x-server-generated-fields']) && task['x-server-generated-fields'].includes(field) && task.properties && task.properties[field] && task.properties[field].readOnly === true, 'B9 scheduled task correlation field ' + field + ' must be server-derived and read-only');
  }

  const reviewed = eventByName(catalog, 'content.version.reviewed.v1');
  const reviewedPayload = resolvePointer(catalog, reviewed && reviewed.payloadSchema && reviewed.payloadSchema.$ref);
  exact(errors, reviewedPayload && reviewedPayload.properties && reviewedPayload.properties.reviewStage && reviewedPayload.properties.reviewStage.enum, REVIEW_STAGES, 'content reviewed payload reviewStage');
}

function checkB1(policy, b1, errors) {
  const role = b1 && b1.components && b1.components.parameters && b1.components.parameters.B1ContentRole;
  add(errors, role && role.name === 'X-Content-Role' && role['x-compatibility-only'] === true && role['x-authority-input-ignored'] === true, 'B1 X-Content-Role must remain an ignored historical compatibility input');
  const legacyWrites = [];
  for (const [route, pathItem] of Object.entries((b1 && b1.paths) || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!['post', 'put', 'patch', 'delete'].includes(method)) continue;
      if (route.includes('/media/')) continue;
      legacyWrites.push({ method: method.toUpperCase(), route, operationId: operation && operation.operationId });
      add(errors, operation && operation.deprecated === true, 'B1 ' + method.toUpperCase() + ' ' + route + ' must be deprecated');
      add(errors, operation && operation['x-canonical-replacement'] && operation['x-canonical-replacement'].operationId === 'submitB9ContentCommand', 'B1 ' + method.toUpperCase() + ' ' + route + ' must point to B9 command replacement');
      exact(errors, operation && operation['x-authority-inputs-ignored'], policy.legacyB1 && policy.legacyB1.authorityInputsIgnored, 'B1 ' + method.toUpperCase() + ' ' + route + ' ignored authority inputs');
    }
  }
  exact(errors, legacyWrites, policy.legacyB1 && policy.legacyB1.deprecatedLifecycleWrites, 'B1 deprecated lifecycle/write operation set');
  const publish = b1 && b1.paths && b1.paths['/api/v1/content/{contentId}/versions/{versionId}/publish'] && b1.paths['/api/v1/content/{contentId}/versions/{versionId}/publish'].post;
  const unpublish = b1 && b1.paths && b1.paths['/api/v1/content/{contentId}/versions/{versionId}/archive'] && b1.paths['/api/v1/content/{contentId}/versions/{versionId}/archive'].post;
  add(errors, publish && publish['x-idempotency'] && publish['x-idempotency'].replayBehavior === '同 contentCode+targetVersionNumber+command 返回首次 PUBLISH 结果；成功只切换 currentPublication 并更新 contentEpoch/projection，旧版本保留为可验证回滚候选且不自动进入 ARCHIVED', 'B1 publish replay semantics must preserve the previous version as a rollback candidate');
  add(errors, unpublish && unpublish['x-migration'] === '将下线意图转换为 B9 UNPUBLISH command；UNPUBLISH 只清除当前发布指针，不把版本持久状态改写为 UNPUBLISHED；ARCHIVED 仅由独立生命周期退休操作产生。', 'B1 archive migration must remain an UNPUBLISH pointer action');
  add(errors, unpublish && unpublish['x-idempotency'] && unpublish['x-idempotency'].replayBehavior === '同 contentCode+contentEpoch+请求摘要返回首次 UNPUBLISH 发布指针结果；重复请求不产生 ARCHIVED，独立退休后的版本状态仅作为只读结果返回', 'B1 archive replay semantics must not turn UNPUBLISH into ARCHIVED');
}

function checkB10(b10, errors) {
  add(errors, findKeywordLocations(b10, 'const').length === 0, 'B10 content OpenAPI 3.0.3 schemas must use singleton enum instead of unsupported const');
  const pin = schema(b10, 'B10ContentVersionPin');
  add(errors, pin && pin.type === 'object' && pin.readOnly === true && pin.additionalProperties === false, 'B10 future-read content pin must be a closed read-only object');
  exact(errors, pin && pin['x-p1r-pin-scope-policy'], B10_PIN_SCOPE_POLICY, 'B10 future-read content pin scope');
  exact(errors, pin && pin.required, B10_FUTURE_PIN_REQUIRED, 'B10 future-read content pin required fields');
  exact(errors, pin && pin.properties, B10_FUTURE_PIN_PROPERTIES, 'B10 future-read content pin properties');
  exact(errors, pin && pin.oneOf, B10_FUTURE_PIN_ONE_OF, 'B10 future-read content pin branches');

  const activePin = schema(b10, 'B10ActiveSessionAttemptPin');
  add(errors, activePin && activePin.type === 'object' && activePin.readOnly === true && activePin.additionalProperties === false, 'B10 active session/attempt pin must be a closed read-only object');
  exact(errors, activePin && activePin['x-p1r-active-pin-policy'], B10_ACTIVE_PIN_POLICY, 'B10 active session/attempt pin policy');
  exact(errors, activePin && activePin.required, B10_ACTIVE_PIN_REQUIRED, 'B10 active session/attempt pin required fields');
  exact(errors, activePin && activePin.properties, B10_ACTIVE_PIN_PROPERTIES, 'B10 active session/attempt pin properties');
  exact(errors, activePin && activePin.oneOf, B10_ACTIVE_PIN_ONE_OF, 'B10 active session/attempt pin branches');
  for (const name of ['B10AssessmentSession', 'B10Attempt', 'B10AssessmentReport', 'B10MasteryProjection']) {
    const parent = schema(b10, name);
    add(errors, parent && parent.properties && parent.properties.pin && parent.properties.pin.$ref === '#/components/schemas/B10ActiveSessionAttemptPin', name + ' must use the immutable active-session/attempt pin');
  }
  for (const name of ['B10LearnerContentSnapshot', 'B10AssessmentContentSnapshot', 'B10LearningQueueItem']) {
    const parent = schema(b10, name);
    add(errors, parent && parent.properties && parent.properties.pin && parent.properties.pin.$ref === '#/components/schemas/B10ContentVersionPin', name + ' must keep the future-read or unstarted-task pin');
  }

  const recovery = schema(b10, 'B10ContentRecovery');
  exact(errors, recovery && recovery.required, ['usageScope', 'requestedVersionId', 'resolution', 'mustNotRegrade', 'resolvedAt'], 'B10 content recovery required fields');
  exact(errors, recovery && recovery['x-p1r-recovery-scope-policy'], B10_RECOVERY_SCOPE_POLICY, 'B10 recovery scope policy');
  exact(errors, recovery && recovery.properties && recovery.properties.usageScope && recovery.properties.usageScope.enum, ['FUTURE_READ_ONLY'], 'B10 recovery usage scope');
  exact(errors, recovery && recovery.properties && recovery.properties.mustNotRegrade && recovery.properties.mustNotRegrade.enum, [true], 'B10 recovery historical regrade prohibition');
  exact(errors, recovery && recovery.properties && recovery.properties.recoveryReasonCode && recovery.properties.recoveryReasonCode.enum, ['NONE', 'CONTENT_UNPUBLISHED', 'RIGHTS_EXPIRED', 'SNAPSHOT_MISSING', 'POLICY_DENIED', 'SERVICE_DEGRADED', 'RIGHTS_REMOVED', 'SECURITY_REMOVED', 'LEGAL_REMOVED'], 'B10 recovery reason-code union');
  exact(errors, recovery && recovery.oneOf, B10_RECOVERY_ONE_OF, 'B10 active/future recovery branches');
  const response = schema(b10, 'B10ContentRecoveryResponse');
  add(errors, response && response.properties && response.properties.data && response.properties.data.$ref === '#/components/schemas/B10ContentRecovery', 'B10 recovery response must use the frozen scoped recovery decision');
  const recoveryOperation = b10 && b10.paths && b10.paths['/internal/v1/content/assessment-snapshots/{contentVersionId}/recovery'] && b10.paths['/internal/v1/content/assessment-snapshots/{contentVersionId}/recovery'].get;
  exact(errors, recoveryOperation && recoveryOperation['x-contract'], {
    owner: 'content-service',
    consumer: 'assessment-service/learning-service',
    recovery: 'exact immutable snapshot first; safe fallback only for future reads; never regrade a historical attempt',
    usageScope: 'FUTURE_READ_ONLY',
    activeSessionOrAttempt: 'PROHIBITED',
  }, 'B10 recovery route scope');
}

function checkEventGovernance(input, errors) {
  const catalog = input.catalog;
  const b26 = input.b26Runtime;
  const canonicalNames = (catalog.events || []).filter(function (event) { return event && event.status === 'CANONICAL_D2'; }).map(function (event) { return event.eventName; });
  for (const eventName of CANONICAL_CONTENT_EVENTS) {
    const event = eventByName(catalog, eventName);
    add(errors, event && event.status === 'CANONICAL_D2', eventName + ' must be CANONICAL_D2');
    add(errors, event && event.schema === 'content.event.v1', eventName + ' schema must remain content.event.v1');
    add(errors, event && event.aggregateIdField === AGGREGATE_FIELDS[eventName], eventName + ' aggregateIdField must preserve its v1 identity');
    exact(errors, event && event['x-envelope-required'], CANONICAL_ENVELOPE, eventName + ' canonical envelope');
    add(errors, event && event['x-p1r-governance'] && event['x-p1r-governance'].producer.service === 'content-service', eventName + ' producer must be content-service');
    add(errors, event && event['x-p1r-governance'] && event['x-p1r-governance'].producer.dataOwner === 'content-service', eventName + ' data owner must be content-service');
    add(errors, event && event['x-p1r-governance'] && event['x-p1r-governance'].producer.outboxRequired === true, eventName + ' must require Outbox');
    add(errors, event && event['x-p1r-governance'] && event['x-p1r-governance'].transport.topic === 'platform.content.v1', eventName + ' must use platform.content.v1');
    add(errors, event && event['x-p1r-governance'] && event['x-p1r-governance'].transport.aggregateIdSource === 'payload.' + AGGREGATE_FIELDS[eventName], eventName + ' aggregate identity source drifted');
    add(errors, event && event['x-p1r-governance'] && event['x-p1r-governance'].runtimeStatus === 'NOT_RUNTIME_VERIFIED', eventName + ' must remain NOT_RUNTIME_VERIFIED');
    exact(errors, ((event && event['x-p1r-governance'] && event['x-p1r-governance'].consumers) || []).map(function (consumer) { return consumer.consumerGroup; }), CONTENT_ROUTES[eventName], eventName + ' governed consumer groups');
  }
  const closureById = new Map((((catalog['x-p1r-event-governance'] || {}).plannedClosures) || []).map(function (closure) {
    return [closure.gapId, closure];
  }));
  const closedIds = [];
  for (const disposition of input.policy.plannedClosureDisposition || []) {
    const closure = closureById.get(disposition.gapId);
    add(errors, closure && closure.status === 'D2_CONTRACT_CLOSED', disposition.gapId + ' must be D2_CONTRACT_CLOSED only');
    add(errors, closure && Array.isArray(closure.d2ClosureTasks) && closure.d2ClosureTasks.includes('P1R-M1-008'), disposition.gapId + ' must retain P1R-M1-008 closure task');
    closedIds.push(disposition.gapId);
  }
  exact(errors, closedIds, ['EVENT-GAP-CONTENT-DUPLICATE', 'EVENT-GAP-BIND-CONT-001'], 'content D2 closed gap set');
  for (const gapId of ['EVENT-GAP-ONB-002', 'EVENT-GAP-PLACEMENT-PLAN']) {
    const closure = closureById.get(gapId);
    add(errors, closure && closure.status === 'D2_CONTRACT_CLOSED', gapId + ' must be D2_CONTRACT_CLOSED only under the frozen P1R-M1-012 successor');
    exact(errors, closure && closure.d2ClosureTasks, ['P1R-M1-012', 'P1R-M1-006'], gapId + ' P1R-M1-012 closure tasks');
  }
  for (const gapId of ['EVENT-GAP-BIND-GAM-001', 'EVENT-GAP-BIND-SOC-001']) {
    const closure = closureById.get(gapId);
    add(errors, closure && closure.status === 'D2_CONTRACT_CLOSED', gapId + ' must be D2_CONTRACT_CLOSED only under the frozen P1R-M1-014 successor');
    exact(errors, closure && closure.d2ClosureTasks, ['P1R-M1-006', 'P1R-M1-014'], gapId + ' P1R-M1-014 closure tasks');
  }
  const notificationBindingClosure = closureById.get(M1016_NOTIFICATION_BINDING_CLOSURE.gapId);
  exact(errors, notificationBindingClosure && {
    gapId: notificationBindingClosure.gapId,
    family: notificationBindingClosure.family,
    status: notificationBindingClosure.status,
    d2ClosureTasks: notificationBindingClosure.d2ClosureTasks,
  }, M1016_NOTIFICATION_BINDING_CLOSURE, 'P1R-M1-016 notification binding closure');
  for (const expectedClosure of [M1017_PRIVACY_BINDING_CLOSURE, M1017_ACCOUNT_DELETION_CLOSURE]) {
    const closure = closureById.get(expectedClosure.gapId);
    exact(errors, closure && {
      gapId: closure.gapId,
      family: closure.family,
      status: closure.status,
      d2ClosureTasks: closure.d2ClosureTasks,
    }, expectedClosure, `P1R-M1-017 ${expectedClosure.gapId} closure`);
  }
  const actualClosed = (((catalog['x-p1r-event-governance'] || {}).plannedClosures) || [])
    .filter(function (closure) { return closure.status === 'D2_CONTRACT_CLOSED'; })
    .map(function (closure) { return closure.gapId; });
  exact(errors, actualClosed, EXPECTED_GLOBAL_D2_CLOSED_EVENT_GAPS, 'catalog D2 closed gap set');
  const actualPlanned = (((catalog['x-p1r-event-governance'] || {}).plannedClosures) || [])
    .filter(function (closure) { return closure.status === 'PLANNED'; })
    .map(function (closure) { return closure.gapId; });
  exact(errors, actualPlanned, EXPECTED_GLOBAL_PLANNED_EVENT_GAPS, 'catalog planned gap set');
  for (const eventName of HISTORICAL_CONTENT_EVENTS) {
    const event = eventByName(catalog, eventName);
    add(errors, event && event.status === 'HISTORICAL_CANDIDATE', eventName + ' must remain HISTORICAL_CANDIDATE');
    add(errors, event && event['x-p1r-governance'] === undefined && event['x-kafka'] === undefined, eventName + ' historical event must not carry active Kafka governance');
    add(errors, !canonicalNames.includes(eventName), eventName + ' must not enter the canonical set');
  }
  const b9Fragment = (input.eventFragments || []).find(function (fragment) {
    return fragment.path === 'packages/contracts/events/v1/fragments/b9-learner-content.events.json';
  });
  add(errors, b9Fragment && isRecord(b9Fragment.data), 'B9 learner-content event fragment is required');
  const reviewedCatalogPayload = catalog && catalog.payloadSchemas && catalog.payloadSchemas.B9ContentVersionReviewed;
  const reviewedFragmentPayload = b9Fragment && b9Fragment.data && b9Fragment.data.payloadSchemas && b9Fragment.data.payloadSchemas.B9ContentVersionReviewed;
  exact(errors, reviewedCatalogPayload, B9_REVIEWED_EVENT_PAYLOAD, 'content.version.reviewed.v1 catalog payload');
  exact(errors, reviewedFragmentPayload, B9_REVIEWED_EVENT_PAYLOAD, 'content.version.reviewed.v1 fragment payload');
  for (const eventName of CANONICAL_CONTENT_EVENTS) {
    const fragmentEvent = ((b9Fragment && b9Fragment.data && b9Fragment.data.events) || []).find(function (event) { return event && event.eventName === eventName; });
    const catalogEvent = eventByName(catalog, eventName);
    exact(errors, fragmentEvent && fragmentEvent['x-envelope-required'], CANONICAL_ENVELOPE, eventName + ' fragment canonical envelope');
    exact(errors, fragmentEvent && fragmentEvent.payloadSchema, catalogEvent && catalogEvent.payloadSchema, eventName + ' fragment payload reference');
    add(errors, fragmentEvent && catalogEvent && fragmentEvent.aggregateIdField === catalogEvent.aggregateIdField, eventName + ' fragment aggregate identity must match catalog');
  }
  const topic = (b26.topics || []).find(function (item) { return item && item.name === 'platform.content.v1'; });
  add(errors, topic && topic.ownerService === 'content-service' && topic.producerPrincipal === 'svc.content-service', 'B26 content topic owner binding drifted');
  exact(errors, (topic && topic.consumerGroups || []).map(function (group) { return group.name; }), ['cg.learner-from-content.v1', 'cg.learning-from-content.v1', 'cg.assessment-from-content.v1', 'cg.admin-ops-from-content.v1', 'cg.audit-from-content.v1'], 'B26 content topic consumer groups');
  const promotionGroups = new Map((topic && topic.consumerGroups || []).map(function (group) { return [group.name, group]; }));
  for (const [groupName, service] of [
    ['cg.admin-ops-from-content.v1', 'admin-ops-service'],
    ['cg.audit-from-content.v1', 'audit-service'],
  ]) {
    const group = promotionGroups.get(groupName);
    add(errors, group && group.service === service && group.principal === groupName && group.replayEnabled === true, groupName + ' compatibility-promotion B26 group binding drifted');
    add(errors, (topic && topic.acl || []).some(function (acl) { return acl && acl.principal === groupName && acl.operation === 'READ' && acl.effect === 'ALLOW'; }), groupName + ' compatibility-promotion B26 ACL drifted');
  }
  const routes = new Map((b26.eventRouting || []).map(function (route) { return [route.eventName, route]; }));
  for (const eventName of CANONICAL_CONTENT_EVENTS) {
    const route = routes.get(eventName);
    add(errors, route && route.topic === 'platform.content.v1' && route.partitionKey === 'aggregateId', eventName + ' B26 route must use platform.content.v1 by aggregateId');
    exact(errors, route && route.consumerGroups, CONTENT_ROUTES[eventName], eventName + ' B26 route consumers');
  }
  add(errors, !routes.has('content.public_projection.invalidated.v1'), 'historical projection invalidation must not gain a B26 Kafka route');
  for (const eventName of CANONICAL_CONTENT_EVENTS) {
    add(errors, (input.reliabilityPolicy.catalog && input.reliabilityPolicy.catalog.currentCanonicalEvents || []).includes(eventName), eventName + ' must be covered by reliability policy');
  }
  add(errors, !Object.hasOwn((catalog.asyncapi && catalog.asyncapi.channels) || {}, 'content_public_projection_invalidated_v1'), 'historical projection invalidation must not enter AsyncAPI');
}

function checkPlacementSuccessor(input, errors) {
  const policy = input.placementPolicy;
  add(errors, stableSha256(policy) === FROZEN_PLACEMENT_POLICY_SHA256, 'P1R-M1-012 placement successor policy digest drifted');
  add(errors, policy.task === 'P1R-M1-012', 'placement successor task must remain P1R-M1-012');
  add(errors, policy.maturity === 'D2_CONTRACT_READY', 'placement successor maturity must remain D2_CONTRACT_READY');
  add(errors, policy.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'placement successor must remain NOT_RUNTIME_VERIFIED');
  add(errors, policy.completionEvent && policy.completionEvent.name === 'assessment.placement.completed.v1' && policy.completionEvent.status === 'CANONICAL_D2', 'placement successor completion event binding drifted');
  add(errors, policy.placementPlanSaga && policy.placementPlanSaga.sagaType === 'PLACEMENT_TO_INITIAL_PLAN_V1' && policy.placementPlanSaga.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'placement-to-plan successor Saga boundary drifted');
  add(errors, policy.learnerPlanningSuccessor && policy.learnerPlanningSuccessor.task === 'P1R-M1-012' && policy.learnerPlanningSuccessor.basePolicyId === 'M1-011_LEARNER_PLANNING_CONTRACT_PROMOTION', 'learner-planning successor binding drifted');
}

function checkLinkedAudits(input, errors) {
  const governance = validateEventGovernanceData({
    catalog: input.catalog, ownerPolicy: input.ownerPolicy, b26Runtime: input.b26Runtime, fragments: input.eventFragments,
  });
  for (const error of governance.errors || []) errors.push('event governance: ' + error);
  const b26 = validateB26EventRuntime(input.b26Runtime, input.b26Fragment, { catalog: input.catalog });
  for (const error of b26.errors || []) errors.push('B26 static candidate: ' + error);
  const reliability = validateEventReliabilityData({
    policy: input.reliabilityPolicy, catalog: input.catalog, b26Runtime: input.b26Runtime,
    b26Fragment: input.b26Fragment, registry: input.registry, sagaPolicy: input.sagaPolicy,
    ownerPolicy: input.ownerPolicy, eventFragments: input.eventFragments,
    m1018Fragment: (input.eventFragments || []).find(function (fragment) {
      return fragment.path === 'packages/contracts/events/v1/fragments/m1-018-iam-v2.events.json';
    })?.data,
  });
  for (const error of reliability.errors || []) errors.push('event reliability: ' + error);
}

export function validateContentLifecycleData(input = {}) {
  const errors = [];
  for (const [key, label] of [
    ['policy', 'content lifecycle policy'], ['b9OpenApi', 'B9 content OpenAPI'],
    ['b9SharedOpenApi', 'B9 shared OpenAPI'],
    ['b1OpenApi', 'B1 content OpenAPI'], ['b10OpenApi', 'B10 learning/assessment content OpenAPI'],
    ['catalog', 'event catalog'],
    ['placementPolicy', 'P1R-M1-012 placement successor policy'],
    ['b26Runtime', 'B26 static candidate'], ['reliabilityPolicy', 'event reliability policy'],
    ['b26Fragment', 'B26 event fragment'], ['registry', 'schema registry'],
    ['sagaPolicy', 'Saga recovery policy'], ['ownerPolicy', 'data ownership policy'],
  ]) add(errors, isRecord(input[key]), label + ' must be an object');
  add(errors, Array.isArray(input.eventFragments), 'event fragments must be an array');
  if (errors.length === 0) {
    checkPlacementSuccessor(input, errors);
    checkPolicy(input.policy, errors);
    checkB9(input.policy, input.b9OpenApi, input.b9SharedOpenApi, input.catalog, errors);
    checkB1(input.policy, input.b1OpenApi, errors);
    checkB10(input.b10OpenApi, errors);
    checkEventGovernance(input, errors);
    checkLinkedAudits(input, errors);
  }
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    summary: {
      taskId: input.policy && input.policy.taskId,
      maturity: input.policy && input.policy.maturity,
      runtimeStatus: input.policy && input.policy.runtimeStatus,
      persistentStates: input.policy && input.policy.persistentVersionStates && input.policy.persistentVersionStates.length || 0,
      commands: input.policy && input.policy.commands && input.policy.commands.length || 0,
      actorClasses: input.policy && input.policy.actorClasses && input.policy.actorClasses.length || 0,
      scheduleStates: input.policy && input.policy.schedule && input.policy.schedule.states && input.policy.schedule.states.length || 0,
      canonicalContentEvents: input.policy && input.policy.eventGovernance && input.policy.eventGovernance.canonicalEvents && input.policy.eventGovernance.canonicalEvents.length || 0,
      historicalContentEvents: input.policy && input.policy.eventGovernance && input.policy.eventGovernance.historicalOnlyEvents && input.policy.eventGovernance.historicalOnlyEvents.length || 0,
    },
    errors,
  };
}

export function readContentLifecycleInputs(options = {}) {
  const root = options.root || defaultRoot;
  return {
    policy: readJson(root, DEFAULT_CONTENT_LIFECYCLE_POLICY),
    b9OpenApi: readJson(root, B9_OPENAPI_PATH),
    b9SharedOpenApi: readJson(root, B9_SHARED_OPENAPI_PATH),
    b1OpenApi: readJson(root, B1_OPENAPI_PATH),
    b10OpenApi: readJson(root, B10_OPENAPI_PATH),
    placementPolicy: readJson(root, DEFAULT_PLACEMENT_POLICY),
    catalog: readJson(root, 'packages/contracts/events/v1/catalog.json'),
    b26Runtime: readJson(root, 'config/b26-event-runtime.json'),
    reliabilityPolicy: readJson(root, 'packages/contracts/events/v1/reliability-policy.json'),
    b26Fragment: readJson(root, B26_FRAGMENT_PATH),
    registry: readJson(root, 'packages/contracts/schemas/v1/registry.json'),
    sagaPolicy: readJson(root, 'config/p1r-saga-recovery.v1.json'),
    ownerPolicy: readJson(root, 'config/p1r-data-ownership.v1.json'),
    eventFragments: listEventFragments(root),
  };
}

export function validateContentLifecycle(options = {}) {
  return validateContentLifecycleData(readContentLifecycleInputs(options));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const report = validateContentLifecycle();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else {
      console.log('P1R content lifecycle D2 ' + report.result + ' (' + report.summary.commands + ' commands, ' + report.summary.canonicalContentEvents + ' canonical content events, runtimeStatus=' + (report.summary.runtimeStatus || 'UNKNOWN') + ').');
      for (const error of report.errors) console.error('- ' + error);
    }
    if (report.result !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
