import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { projectCanonicalAsyncApi } from '../contracts/event-governance-projection.mjs';
import {
  EXPECTED_EVENT_CATALOG_KEYS,
  EXPECTED_EVENT_FRAGMENT_INVENTORY,
  eventPayloadSchemaName,
  validateEventPayloadSchemas,
  validateExactEventPayloadReference,
  validateFrozenEventCatalogPolicy,
} from '../contracts/event-catalog-policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, '..', '..');

const CANONICAL_STATUS = 'CANONICAL_D2';
const HISTORICAL_STATUS = 'HISTORICAL_CANDIDATE';
const DEPRECATED_STATUS = 'DEPRECATED';
const EXPECTED_STATUSES = [CANONICAL_STATUS, HISTORICAL_STATUS, DEPRECATED_STATUS];
const EVENT_FRAGMENT_PATH_PATTERN = /^packages\/contracts\/events\/v1\/fragments\/[a-z0-9-]+\.events\.json$/;
const BASE_EVENT_KEYS = [
  'eventName', 'status', 'domain', 'version', 'schema', 'aggregateType',
  'aggregateIdField', 'payloadSchema', 'compatibility',
];
const EXPECTED_CANONICAL_EVENTS = [
  'assessment.item.assessed.v2',
  'assessment.placement.completed.v1',
  'commerce.entitlement.activated.v2',
  'commerce.entitlement.revoked.v2',
  'commerce.order.created.v2',
  'commerce.payment.callback_received.v2',
  'commerce.payment.requested.v2',
  'commerce.payment.verified.v2',
  'commerce.reconciliation.discrepancy_recorded.v2',
  'commerce.reconciliation.recovery_receipted.v2',
  'commerce.refund.settled.v2',
  'content.version.published.v1',
  'content.version.reviewed.v1',
  'content.version.rolled_back.v1',
  'content.version.submitted.v1',
  'content.version.unpublished.v1',
  'gamification.reward.granted.v2',
  'gamification.xp.ledger_posted.v2',
  'leaderboard.snapshot_published.v2',
  'learner.target.updated.v1',
  'learning.mastery.projected.v2',
  'learning.review.scheduled.v2',
  'learning.task.completed.v2',
  'notification.recovery.completed.v2',
  'notification.requested.v2',
  'notification.retry_scheduled.v2',
  'social.report.created.v2',
  'study_room.focus_started.v2',
  'study_room.seat_joined.v2',
  'study_room.seat_left.v2',
  'support.ticket.created.v2',
  'support.ticket.resolved.v2',
  'sync.command_receipted.v2',
  'sync.conflict_detected.v2',
  'sync.recovered.v2',
  'workflow.outbox.published.v1',
  'workflow.event.delivery_failed.v1',
  'workflow.event.dead_lettered.v1',
  'workflow.event.replay_requested.v1',
  'workflow.event.ordering_deferred.v1',
  'workflow.saga.compensation_requested.v1',
  'workflow.saga.manual_recovery_requested.v1',
].sort();
const EXPECTED_GAP_CLOSURE_ORDER = [
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
  'EVENT-GAP-BIND-NOTIF-001',
  'EVENT-GAP-BIND-PRIV-001',
  'EVENT-GAP-USR-DEL-001',
  'EVENT-GAP-BIND',
];
const M1016_EVENT_TRACEABILITY = new Map([
  ['notification.requested.v2', ['ARCH-EVT-001', 'INT-P1-013']],
  ['notification.retry_scheduled.v2', ['ARCH-EVT-001', 'INT-P1-013']],
  ['notification.recovery.completed.v2', ['ARCH-EVT-001', 'INT-P1-013']],
  ['sync.command_receipted.v2', ['ARCH-EVT-001', 'INT-P1-014']],
  ['sync.conflict_detected.v2', ['ARCH-EVT-001', 'INT-P1-014']],
  ['sync.recovered.v2', ['ARCH-EVT-001', 'INT-P1-014']],
  ['support.ticket.created.v2', ['ARCH-EVT-001', 'INT-P1-012']],
  ['support.ticket.resolved.v2', ['ARCH-EVT-001', 'INT-P1-012']],
]);
const EXPECTED_GAP_CLOSURES = [...EXPECTED_GAP_CLOSURE_ORDER].sort();
const D2_CONTRACT_CLOSED_GAPS = new Set([
  'EVENT-GAP-ONB-001',
  'EVENT-GAP-ONB-002',
  'EVENT-GAP-PLACEMENT-PLAN',
  'EVENT-GAP-CONTENT-DUPLICATE',
  'EVENT-GAP-BIND-CONT-001',
  'EVENT-GAP-BIND-ASM-001',
  'EVENT-GAP-BIND-LRN-001',
  'EVENT-GAP-BIND-GAM-001',
  'EVENT-GAP-BIND-SOC-001',
  'EVENT-GAP-BIND-NOTIF-001',
]);
const EXPECTED_GAP_CLOSURE_DETAILS = {
  'EVENT-GAP-IAM-001': { family: 'EVENT-GAP-IAM', d2ClosureTasks: ['P1R-M1-003', 'P1R-M1-006'] },
  'EVENT-GAP-BIND-IAM-001': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006'] },
  'EVENT-GAP-BIND-IAM-002': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006'] },
  'EVENT-GAP-ONB-001': { family: 'EVENT-GAP-ONB', d2ClosureTasks: ['P1R-M1-011', 'P1R-M1-006'] },
  'EVENT-GAP-ONB-002': { family: 'EVENT-GAP-ONB', d2ClosureTasks: ['P1R-M1-012', 'P1R-M1-006'] },
  'EVENT-GAP-PLACEMENT-PLAN': { family: 'EVENT-GAP-PLACEMENT', d2ClosureTasks: ['P1R-M1-012', 'P1R-M1-006'] },
  'EVENT-GAP-CONTENT-DUPLICATE': { family: 'EVENT-GAP-CONTENT', d2ClosureTasks: ['P1R-M1-008', 'P1R-M1-006'] },
  'EVENT-GAP-BIND-CONT-001': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-008'] },
  'EVENT-GAP-BIND-ASM-001': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-010', 'P1R-M1-013'] },
  'EVENT-GAP-BIND-LRN-001': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-013'] },
  'EVENT-GAP-BIND-GAM-001': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-014'] },
  'EVENT-GAP-BIND-SOC-001': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-014'] },
  'EVENT-GAP-BIND-NOTIF-001': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-016'] },
  'EVENT-GAP-BIND-PRIV-001': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-017'] },
  'EVENT-GAP-USR-DEL-001': { family: 'EVENT-GAP-USR-DEL', d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-017'] },
  'EVENT-GAP-BIND': { family: 'EVENT-GAP-BIND', d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-018'] },
};
const REQUIRED_ENVELOPE = [
  'eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType',
  'aggregateId', 'actorId', 'traceId', 'requestId', 'schemaVersion', 'dedupeKey', 'payload',
];
const REQUIRED_CORRELATION = ['eventId', 'aggregateId', 'requestId', 'traceId', 'dedupeKey'];
const TRUSTED_COMPLETION_TUPLE_FIELDS = ['producerService', 'eventName', 'schemaVersion', 'qualifiedPredicate', 'rewardRuleVersion'];
const TRUSTED_COMPLETION_LINEAGE_FIELDS = ['eventId', 'traceId', 'schemaVersion', 'contentPin'];
const TRUSTED_COMPLETION_DERIVED_FIELD_MAPPINGS = {
  rewardRuleVersion: {
    kind: 'SERVER_SELECTED_GAMIFICATION_RULE_VERSION',
    owner: 'gamification-service',
    clientSupplied: false,
  },
};
const TRUSTED_COMPLETION_RECEIPT_FIELDS = ['tupleKey', 'dedupeKey', 'lineageDigest', 'ledgerEntryId', 'rewardRuleVersion', 'decision', 'decisionReason'];
const EXPECTED_TRUSTED_COMPLETION_PROFILES = [
  {
    id: 'TASK_COMPLETED',
    producerService: 'learning-service',
    eventName: 'learning.task.completed.v2',
    schemaVersion: 'v2',
    qualifiedPredicate: { taskStatus: 'COMPLETED', completionFact: 'SERVER_SETTLED' },
    lineageFields: ['eventId', 'traceId', 'schemaVersion', 'taskId', 'completionVersion', 'rootEventId', 'contentPin', 'rulePin', 'outcomeDigest'],
    lineageFieldOrigins: {
      eventId: 'ENVELOPE',
      traceId: 'ENVELOPE',
      schemaVersion: 'ENVELOPE',
      taskId: 'PAYLOAD',
      completionVersion: 'PAYLOAD',
      rootEventId: 'PAYLOAD',
      contentPin: 'PAYLOAD',
      rulePin: 'PAYLOAD',
      outcomeDigest: 'PAYLOAD',
    },
    dedupeFields: ['taskId', 'completionVersion', 'rootEventId', 'rewardRuleVersion'],
    dedupeFieldOrigins: {
      taskId: 'PAYLOAD',
      completionVersion: 'PAYLOAD',
      rootEventId: 'PAYLOAD',
      rewardRuleVersion: 'DERIVED:rewardRuleVersion',
    },
    maturity: 'FUTURE_D2_CONTRACT_ONLY',
  },
  {
    id: 'ASSESSMENT_ITEM_CORRECT',
    producerService: 'assessment-service',
    eventName: 'assessment.item.assessed.v2',
    schemaVersion: 'v2',
    qualifiedPredicate: { objectiveOutcome: 'CORRECT_VERIFIED', objectiveCorrect: true, guessSignal: false },
    lineageFields: ['eventId', 'traceId', 'schemaVersion', 'itemAssessmentId', 'attemptId', 'logicalItemId', 'contentPin', 'rulePin', 'objectivePolicyPin', 'outcomeDigest'],
    lineageFieldOrigins: {
      eventId: 'ENVELOPE',
      traceId: 'ENVELOPE',
      schemaVersion: 'ENVELOPE',
      itemAssessmentId: 'PAYLOAD',
      attemptId: 'PAYLOAD',
      logicalItemId: 'PAYLOAD',
      contentPin: 'PAYLOAD',
      rulePin: 'PAYLOAD',
      objectivePolicyPin: 'PAYLOAD',
      outcomeDigest: 'PAYLOAD',
    },
    dedupeFields: ['itemAssessmentId', 'eventId', 'rewardRuleVersion'],
    dedupeFieldOrigins: {
      itemAssessmentId: 'PAYLOAD',
      eventId: 'ENVELOPE',
      rewardRuleVersion: 'DERIVED:rewardRuleVersion',
    },
    maturity: 'CANONICAL_D2_INPUT_ONLY',
  },
  {
    id: 'MASTERY_MILESTONE',
    producerService: 'learning-service',
    eventName: 'learning.mastery.projected.v2',
    schemaVersion: 'v2',
    qualifiedPredicate: {
      masteryStageAfter: ['MASTERED', 'CONSOLIDATED'],
      d7Gate: { result: 'PASSED', reasonCode: 'D7_PASSED' },
      stateTransition: {
        kind: 'DERIVED_MASTERY_STAGE_CHANGE',
        inputFields: ['masteryStageBefore', 'masteryStageAfter'],
        expression: 'masteryStageBefore != masteryStageAfter',
        clientSupplied: false,
      },
    },
    lineageFields: ['eventId', 'traceId', 'schemaVersion', 'projectionId', 'masteryEpochId', 'masteryEpochVersion', 'projectionVersion', 'sourceAssessmentEventId', 'sourceItemAssessmentId', 'contentPin', 'masteryStageBefore', 'masteryRuleVersion', 'evidenceDigest'],
    lineageFieldOrigins: {
      eventId: 'ENVELOPE',
      traceId: 'ENVELOPE',
      schemaVersion: 'ENVELOPE',
      projectionId: 'PAYLOAD',
      masteryEpochId: 'PAYLOAD',
      masteryEpochVersion: 'PAYLOAD',
      projectionVersion: 'PAYLOAD',
      sourceAssessmentEventId: 'PAYLOAD',
      sourceItemAssessmentId: 'PAYLOAD',
      contentPin: 'PAYLOAD',
      masteryStageBefore: 'PAYLOAD',
      masteryRuleVersion: 'PAYLOAD',
      evidenceDigest: 'PAYLOAD',
    },
    dedupeFields: ['masteryEpochId', 'projectionVersion', 'rewardRuleVersion'],
    dedupeFieldOrigins: {
      masteryEpochId: 'PAYLOAD',
      projectionVersion: 'PAYLOAD',
      rewardRuleVersion: 'DERIVED:rewardRuleVersion',
    },
    maturity: 'CANONICAL_D2_INPUT_ONLY',
  },
];
const TRUSTED_COMPLETION_REJECTED_EVENT_NAMES = [
  'learning.task.completed.v1',
  'learning.review.scheduled.v2',
  'assessment.item.assessed.v1',
  'learning.mastery.projected.v1',
];
const TRUSTED_COMPLETION_REJECTED_CANONICAL_EVENTS = [
  {
    eventName: 'learning.review.scheduled.v2',
    producerService: 'learning-service',
    schemaVersion: 'v2',
    classification: 'CANONICAL_D2_QUEUE_FACT_REJECTED_FOR_REWARD',
    reason: 'QUEUE_FACT_NOT_A_COMPLETION',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  },
];
const TRUSTED_COMPLETION_REJECTION_REASONS = {
  'learning.task.completed.v1': 'HISTORICAL_CANDIDATE_NOT_CANONICAL',
  'learning.review.scheduled.v2': 'QUEUE_FACT_NOT_A_COMPLETION',
  'assessment.item.assessed.v1': 'HISTORICAL_OR_UNPINNED',
  'learning.mastery.projected.v1': 'HISTORICAL_OR_UNPINNED',
};
const TRUSTED_COMPLETION_ROUTING = {
  'assessment.item.assessed.v2': ['cg.learning-from-assessment.v1', 'cg.gamification-from-assessment.v1', 'cg.workflow-from-assessment.v1'],
  'learning.task.completed.v2': ['cg.gamification-from-learning.v1', 'cg.workflow-from-learning.v1'],
  'learning.mastery.projected.v2': ['cg.assessment-from-learning.v1', 'cg.gamification-from-learning.v1', 'cg.social-from-learning.v1', 'cg.workflow-from-learning.v1'],
};
const TRUSTED_COMPLETION_DERIVED_ORIGIN_PREFIX = 'DERIVED:';
const MASTERY_MILESTONE_DERIVED_TRANSITION = {
  kind: 'DERIVED_MASTERY_STAGE_CHANGE',
  inputFields: ['masteryStageBefore', 'masteryStageAfter'],
  expression: 'masteryStageBefore != masteryStageAfter',
  clientSupplied: false,
};
const PLACEMENT_COMPLETED_EVENT = 'assessment.placement.completed.v1';
const PLACEMENT_COMMON_REQUIRED = [
  'tenantId', 'principalId', 'sessionId', 'stateVersion', 'sessionSnapshotDigest',
  'placementResultId', 'resultVersion', 'reportId', 'reportVersion', 'resultDigest', 'reportDigest',
  'placementManifestId', 'placementManifestVersion', 'placementManifestDigest', 'dimensionSetDigest', 'totalItemCount',
  'contentVersionId', 'contentEpoch', 'snapshotId', 'snapshotHash',
  'answerRuleSetVersion', 'answerRuleVersion', 'ruleDigest', 'completionRuleVersion',
  'targetId', 'targetVersion', 'targetSnapshotDigest',
  'resultKind', 'completionStatus', 'aggregateScore', 'referenceLevel', 'confidence', 'coverageRatio', 'completedAt',
];
const PLACEMENT_DIMENSIONS = ['VOCABULARY', 'BASIC_GRAMMAR', 'READING', 'LISTENING'];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactKeys(errors, value, expected, label) {
  add(errors, isRecord(value), `${label} must be an object`);
  if (!isRecord(value)) return;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  add(errors, JSON.stringify(actual) === JSON.stringify(wanted), `${label} keys must be exactly ${wanted.join(', ')}`);
}

function duplicates(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();
}

function countEventGapClosures(closures) {
  return (closures ?? []).reduce((counts, closure) => {
    if (closure?.status === 'PLANNED') counts.plannedEventGaps += 1;
    if (closure?.status === 'D2_CONTRACT_CLOSED') counts.d2ContractClosedEventGaps += 1;
    return counts;
  }, {
    plannedEventGaps: 0,
    d2ContractClosedEventGaps: 0,
  });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function exactValue(errors, actual, expected, label) {
  add(errors, stableJson(actual) === stableJson(expected), `${label} must exactly match the frozen M1-012 placement contract`);
}

function snakeCaseIdentifier(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function resolveLocalReference(document, reference) {
  if (typeof reference !== 'string' || !reference.startsWith('#/')) return undefined;
  return reference.slice(2).split('/').reduce(
    (current, token) => current?.[token.replaceAll('~1', '/').replaceAll('~0', '~')],
    document,
  );
}

function checkPlacementCompletedPayload(payload, errors) {
  const label = `${PLACEMENT_COMPLETED_EVENT} payload`;
  add(errors, isRecord(payload), `${label} must be an object`);
  if (!isRecord(payload)) return;

  add(errors, payload.$id === 'platform.events.assessment.placement.completed.v1.payload', `${label} must retain its stable schema identity`);
  add(errors, payload.type === 'object' && payload.additionalProperties === false, `${label} must be a closed object`);
  exactValue(errors, payload.required, PLACEMENT_COMMON_REQUIRED, `${label}.required`);
  exactKeys(errors, payload.properties, [...PLACEMENT_COMMON_REQUIRED, 'dimensionSummaries', 'requestedStartingLevel'], `${label}.properties`);

  const properties = payload.properties ?? {};
  for (const envelopeOnlyField of ['eventId', 'sourceEventId', 'rootEventId']) {
    add(errors, !Object.hasOwn(properties, envelopeOnlyField), `${label} must not duplicate envelope-only ${envelopeOnlyField}`);
  }
  exactValue(errors, properties.placementResultId, { type: 'string', pattern: '^plr_[A-Za-z0-9._:-]{8,127}$' }, `${label}.placementResultId`);
  exactValue(errors, properties.reportDigest, { type: 'string', pattern: '^[a-f0-9]{64}$' }, `${label}.reportDigest`);
  exactValue(errors, properties.placementManifestId, { type: 'string', const: 'P1_PLACEMENT_V1' }, `${label}.placementManifestId`);
  exactValue(errors, properties.placementManifestVersion, { type: 'string', const: 'P1_PLACEMENT_V1' }, `${label}.placementManifestVersion`);
  exactValue(errors, properties.totalItemCount, { type: 'integer', const: 10 }, `${label}.totalItemCount`);
  exactValue(errors, properties.resultKind, { type: 'string', enum: ['ASSESSED', 'SKIPPED'] }, `${label}.resultKind`);
  exactValue(errors, properties.completionStatus, { type: 'string', enum: ['COMPLETED', 'SKIPPED'] }, `${label}.completionStatus`);
  exactValue(errors, properties.aggregateScore, { type: ['integer', 'null'] }, `${label}.aggregateScore`);
  exactValue(errors, properties.referenceLevel, { type: ['string', 'null'] }, `${label}.referenceLevel`);
  exactValue(errors, properties.confidence, { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED'] }, `${label}.confidence`);
  exactValue(errors, properties.coverageRatio, { type: 'number', minimum: 0, maximum: 1 }, `${label}.coverageRatio`);
  exactValue(errors, properties.requestedStartingLevel, {
    type: 'object',
    additionalProperties: false,
    required: ['level', 'authority'],
    properties: {
      level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
      authority: { type: 'string', const: 'USER_SELECTED_NON_AUTHORITATIVE' },
    },
  }, `${label}.requestedStartingLevel`);

  const dimensions = properties.dimensionSummaries;
  exactKeys(errors, dimensions, ['type', 'minItems', 'maxItems', 'prefixItems', 'items'], `${label}.dimensionSummaries`);
  add(errors, dimensions?.type === 'array' && dimensions?.minItems === 4 && dimensions?.maxItems === 4 && dimensions?.items === false, `${label}.dimensionSummaries must be the closed four-dimension tuple`);
  const prefixItems = Array.isArray(dimensions?.prefixItems) ? dimensions.prefixItems : [];
  add(errors, prefixItems.length === PLACEMENT_DIMENSIONS.length, `${label}.dimensionSummaries must retain four ordered dimension summaries`);
  for (const [index, dimensionId] of prefixItems.entries()) {
    const dimensionLabel = `${label}.dimensionSummaries.prefixItems[${index}]`;
    exactKeys(errors, dimensionId, ['type', 'additionalProperties', 'required', 'properties'], dimensionLabel);
    add(errors, dimensionId?.type === 'object' && dimensionId?.additionalProperties === false, `${dimensionLabel} must be a closed object`);
    exactValue(errors, dimensionId?.required, ['dimensionId', 'dimensionPercent', 'coverageRatio'], `${dimensionLabel}.required`);
    exactKeys(errors, dimensionId?.properties, ['dimensionId', 'dimensionPercent', 'coverageRatio'], `${dimensionLabel}.properties`);
    exactValue(errors, dimensionId?.properties?.dimensionId, { type: 'string', const: PLACEMENT_DIMENSIONS[index] }, `${dimensionLabel}.dimensionId`);
    exactValue(errors, dimensionId?.properties?.dimensionPercent, { type: 'number', minimum: 0, maximum: 100 }, `${dimensionLabel}.dimensionPercent`);
    exactValue(errors, dimensionId?.properties?.coverageRatio, { type: 'number', minimum: 0, maximum: 1 }, `${dimensionLabel}.coverageRatio`);
  }

  const oneOf = Array.isArray(payload.oneOf) ? payload.oneOf : [];
  add(errors, oneOf.length === 2, `${label} must have exactly ASSESSED and SKIPPED branches`);
  const branches = new Map(oneOf.map((branch) => [branch?.properties?.resultKind?.const, branch]));
  add(errors, branches.size === 2 && branches.has('ASSESSED') && branches.has('SKIPPED'), `${label} branches must be keyed by ASSESSED and SKIPPED only`);
  const assessed = branches.get('ASSESSED');
  const skipped = branches.get('SKIPPED');
  exactKeys(errors, assessed, ['required', 'properties', 'not'], `${label}.ASSESSED`);
  exactValue(errors, assessed?.required, ['resultKind', 'completionStatus', 'aggregateScore', 'referenceLevel', 'confidence', 'coverageRatio', 'dimensionSummaries'], `${label}.ASSESSED.required`);
  exactKeys(errors, assessed?.properties, ['resultKind', 'completionStatus', 'aggregateScore', 'referenceLevel', 'confidence', 'coverageRatio'], `${label}.ASSESSED.properties`);
  exactValue(errors, assessed?.properties?.resultKind, { const: 'ASSESSED' }, `${label}.ASSESSED.resultKind`);
  exactValue(errors, assessed?.properties?.completionStatus, { const: 'COMPLETED' }, `${label}.ASSESSED.completionStatus`);
  exactValue(errors, assessed?.properties?.aggregateScore, { type: 'integer', minimum: 0, maximum: 100 }, `${label}.ASSESSED.aggregateScore`);
  exactValue(errors, assessed?.properties?.referenceLevel, { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }, `${label}.ASSESSED.referenceLevel`);
  exactValue(errors, assessed?.properties?.confidence, { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] }, `${label}.ASSESSED.confidence`);
  exactValue(errors, assessed?.properties?.coverageRatio, { type: 'number', exclusiveMinimum: 0, maximum: 1 }, `${label}.ASSESSED.coverageRatio`);
  exactValue(errors, assessed?.not, { required: ['requestedStartingLevel'] }, `${label}.ASSESSED.not`);

  exactKeys(errors, skipped, ['required', 'properties', 'not'], `${label}.SKIPPED`);
  exactValue(errors, skipped?.required, ['resultKind', 'completionStatus', 'aggregateScore', 'referenceLevel', 'confidence', 'coverageRatio'], `${label}.SKIPPED.required`);
  exactKeys(errors, skipped?.properties, ['resultKind', 'completionStatus', 'aggregateScore', 'referenceLevel', 'confidence', 'coverageRatio'], `${label}.SKIPPED.properties`);
  exactValue(errors, skipped?.properties?.resultKind, { const: 'SKIPPED' }, `${label}.SKIPPED.resultKind`);
  exactValue(errors, skipped?.properties?.completionStatus, { const: 'SKIPPED' }, `${label}.SKIPPED.completionStatus`);
  exactValue(errors, skipped?.properties?.aggregateScore, { type: 'null' }, `${label}.SKIPPED.aggregateScore`);
  exactValue(errors, skipped?.properties?.referenceLevel, { type: 'null' }, `${label}.SKIPPED.referenceLevel`);
  exactValue(errors, skipped?.properties?.confidence, { const: 'UNVERIFIED' }, `${label}.SKIPPED.confidence`);
  exactValue(errors, skipped?.properties?.coverageRatio, { const: 0 }, `${label}.SKIPPED.coverageRatio`);
  exactValue(errors, skipped?.not, { required: ['dimensionSummaries'] }, `${label}.SKIPPED.not`);
}

export function listEventFragments(root) {
  const directory = path.join(root, 'packages', 'contracts', 'events', 'v1', 'fragments');
  const files = [];
  const visit = (currentDirectory) => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const filePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.events.json')) {
        files.push(filePath);
      }
    }
  };
  visit(directory);
  return files
    .sort((left, right) => left.localeCompare(right))
    .map((filePath) => ({
      path: path.relative(root, filePath).replaceAll('\\', '/'),
      data: JSON.parse(fs.readFileSync(filePath, 'utf8')),
    }));
}

function checkPlatformGovernance(catalog, errors) {
  exactKeys(errors, catalog, EXPECTED_EVENT_CATALOG_KEYS, 'event catalog');
  errors.push(...validateFrozenEventCatalogPolicy(catalog));
  const governance = catalog['x-p1r-event-governance'];
  exactKeys(errors, governance, [
    'schemaVersion', 'maturity', 'runtimeStatus', 'transportPolicy', 'allowedStatuses',
    'traceability', 'fragmentInventory', 'plannedClosures',
  ], 'x-p1r-event-governance');
  if (!isRecord(governance)) return;
  add(errors, governance.schemaVersion === 'p1r.event-governance.v1', 'event governance schemaVersion must be p1r.event-governance.v1');
  add(errors, governance.maturity === 'D2_CONTRACT_READY', 'event governance maturity must be D2_CONTRACT_READY');
  add(errors, governance.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'event governance runtimeStatus must remain NOT_RUNTIME_VERIFIED');
  exactKeys(errors, governance.transportPolicy, ['canonical', 'coreApiV1RabbitMq', 'redisStreams', 'clientProducer'], 'event transportPolicy');
  add(errors, governance.transportPolicy?.canonical === 'KAFKA_COMPATIBLE_ONLY', 'canonical event transport must be Kafka-compatible only');
  add(errors, governance.transportPolicy?.coreApiV1RabbitMq === 'HISTORICAL_MIGRATION_ONLY', 'RabbitMQ must remain core-api v1 historical migration only');
  add(errors, governance.transportPolicy?.redisStreams === 'PROHIBITED', 'Redis Streams must be prohibited as a v2 event source');
  add(errors, governance.transportPolicy?.clientProducer === 'PROHIBITED', 'clients must be prohibited from producing Kafka events');
  add(errors, JSON.stringify(governance.allowedStatuses) === JSON.stringify(EXPECTED_STATUSES), 'allowed event statuses must be exact and ordered');
  exactKeys(errors, governance.traceability, ['sourceRefs'], 'event governance traceability');
  add(errors, governance.traceability?.sourceRefs?.includes('ARCH-EVT-001'), 'event governance must trace to ARCH-EVT-001');
  add(errors, governance.traceability?.sourceRefs?.includes('INT-P1-017'), 'event governance must trace to INT-P1-017');

  add(errors, stableJson(governance.fragmentInventory) === stableJson(EXPECTED_EVENT_FRAGMENT_INVENTORY), 'fragmentInventory must exactly match the frozen M1-006 source inventory');
  add(errors, Array.isArray(governance.fragmentInventory) && governance.fragmentInventory.length === 18, 'fragmentInventory must contain the exact 18 governed fragment records');
  const inventoryPaths = [];
  for (const [index, fragment] of (governance.fragmentInventory ?? []).entries()) {
    exactKeys(errors, fragment, ['path', 'eventNames'], `fragmentInventory[${index}]`);
    inventoryPaths.push(fragment?.path);
    add(errors, EVENT_FRAGMENT_PATH_PATTERN.test(fragment?.path ?? ''), `fragmentInventory[${index}].path must identify one canonical .events.json fragment`);
    add(errors, Array.isArray(fragment?.eventNames) && fragment.eventNames.length > 0, `fragmentInventory[${index}].eventNames must be a non-empty array`);
    add(errors, (fragment?.eventNames ?? []).every((eventName) => /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+\.v[0-9]+$/.test(eventName)), `fragmentInventory[${index}] contains an invalid event name`);
    add(errors, duplicates(fragment?.eventNames ?? []).length === 0, `fragmentInventory[${index}] duplicates event names: ${duplicates(fragment?.eventNames ?? []).join(', ')}`);
  }
  add(errors, duplicates(inventoryPaths).length === 0, `fragmentInventory duplicates fragment paths: ${duplicates(inventoryPaths).join(', ')}`);
  add(errors, JSON.stringify(inventoryPaths) === JSON.stringify([...inventoryPaths].sort()), 'fragmentInventory must preserve canonical path order');

  add(errors, Array.isArray(governance.plannedClosures), 'plannedClosures must be an array');
  const gapIds = [];
  for (const [index, closure] of (governance.plannedClosures ?? []).entries()) {
    exactKeys(errors, closure, ['gapId', 'family', 'status', 'd2ClosureTasks'], `plannedClosures[${index}]`);
    gapIds.push(closure?.gapId);
    add(errors, nonEmptyString(closure?.gapId) && nonEmptyString(closure?.family), `plannedClosures[${index}] identifiers are required`);
    const expectedStatus = D2_CONTRACT_CLOSED_GAPS.has(closure?.gapId) ? 'D2_CONTRACT_CLOSED' : 'PLANNED';
    add(errors, closure?.status === expectedStatus, `plannedClosures[${index}] status must remain ${expectedStatus}`);
    add(errors, Array.isArray(closure?.d2ClosureTasks) && closure.d2ClosureTasks.includes('P1R-M1-006'), `plannedClosures[${index}] must include P1R-M1-006`);
    add(errors, (closure?.d2ClosureTasks ?? []).every((taskId) => /^P1R-M1-\d{3}$/.test(taskId)), `plannedClosures[${index}] has an invalid D2 closure task`);
    add(errors, duplicates(closure?.d2ClosureTasks ?? []).length === 0, `plannedClosures[${index}] duplicates a D2 closure task`);
    const expected = EXPECTED_GAP_CLOSURE_DETAILS[closure?.gapId];
    add(errors, expected?.family === closure?.family, `plannedClosures[${index}] family must match the frozen gap registry`);
    add(errors, JSON.stringify(expected?.d2ClosureTasks) === JSON.stringify(closure?.d2ClosureTasks), `plannedClosures[${index}] D2 closure tasks must match the frozen task mapping`);
  }
  add(errors, duplicates(gapIds).length === 0, `plannedClosures duplicate gap IDs: ${duplicates(gapIds).join(', ')}`);
  add(errors, JSON.stringify([...gapIds].sort()) === JSON.stringify(EXPECTED_GAP_CLOSURES), 'plannedClosures must cover the exact M1-006 event gap registry');
  add(errors, JSON.stringify(gapIds) === JSON.stringify(EXPECTED_GAP_CLOSURE_ORDER), 'plannedClosures must preserve the canonical gap registry order');
  const closureCounts = countEventGapClosures(governance.plannedClosures);
  add(errors, closureCounts.plannedEventGaps === EXPECTED_GAP_CLOSURE_ORDER.length - D2_CONTRACT_CLOSED_GAPS.size, 'plannedClosures must retain exactly six PLANNED event gaps');
  add(errors, closureCounts.d2ContractClosedEventGaps === D2_CONTRACT_CLOSED_GAPS.size, 'plannedClosures must retain exactly ten D2_CONTRACT_CLOSED event gaps');
}

function checkCanonicalEvent({ event, catalog, services, dataOwners, routeByEvent, topicByName, usedIds, groupService }, errors) {
  const label = event.eventName;
  const governance = event['x-p1r-governance'];
  exactKeys(errors, governance, ['status', 'runtimeStatus', 'scope', 'producer', 'consumers', 'transport', 'schema', 'correlation', 'traceability'], `${label}.x-p1r-governance`);
  if (!isRecord(governance)) return;
  add(errors, governance.status === CANONICAL_STATUS, `${label} governance status must match CANONICAL_D2`);
  add(errors, governance.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${label} must remain NOT_RUNTIME_VERIFIED`);
  add(errors, governance.scope === 'CROSS_SERVICE_INTEGRATION_FACT', `${label} must be a cross-service integration fact`);

  exactKeys(errors, governance.producer, ['service', 'dataOwner', 'outboxRequired', 'publishOperationId'], `${label}.producer`);
  add(errors, services.has(governance.producer?.service), `${label} producer service is unknown`);
  add(errors, dataOwners.has(governance.producer?.dataOwner), `${label} data owner is unknown`);
  add(errors, governance.producer?.service === governance.producer?.dataOwner, `${label} producer must be its data owner`);
  add(errors, governance.producer?.service !== 'api-gateway', `${label} Gateway cannot produce or own domain events`);
  add(errors, governance.producer?.outboxRequired === true, `${label} canonical producer must require Outbox`);
  const normalizedEventName = snakeCaseIdentifier(label);
  add(errors, governance.producer?.publishOperationId === `publish_${normalizedEventName}`, `${label} publishOperationId must be canonical and deterministic`);
  add(errors, !usedIds.has(governance.producer?.publishOperationId), `${label} publishOperationId is duplicated`);
  usedIds.add(governance.producer?.publishOperationId);

  add(errors, Array.isArray(governance.consumers) && governance.consumers.length > 0, `${label} must have at least one explicit consumer`);
  const consumerGroups = [];
  for (const [index, consumer] of (governance.consumers ?? []).entries()) {
    exactKeys(errors, consumer, ['service', 'consumerGroup', 'subscriptionOperationId'], `${label}.consumers[${index}]`);
    add(errors, services.has(consumer?.service) && consumer.service !== 'api-gateway', `${label} consumer service is unknown or forbidden`);
    add(errors, /^cg\.[a-z0-9.-]+\.v\d+$/.test(consumer?.consumerGroup ?? ''), `${label} consumerGroup is invalid`);
    add(errors, !/client|browser|frontend/i.test(consumer?.consumerGroup ?? ''), `${label} consumerGroup cannot represent a client`);
    add(errors, consumer?.subscriptionOperationId === `subscribe_${normalizedEventName}_${snakeCaseIdentifier(consumer?.consumerGroup)}`, `${label} subscriptionOperationId must be canonical and deterministic`);
    add(errors, !usedIds.has(consumer?.subscriptionOperationId), `${label} subscriptionOperationId is duplicated`);
    usedIds.add(consumer?.subscriptionOperationId);
    consumerGroups.push(consumer?.consumerGroup);
    const route = routeByEvent.get(label);
    const topic = topicByName.get(route?.topic);
    const topicGroups = new Map((topic?.consumerGroups ?? []).map((group) => [group.name, group.service]));
    const knownOwner = topicGroups.get(consumer?.consumerGroup);
    add(errors, knownOwner === consumer?.service, `${label} ${consumer?.consumerGroup} must belong to ${knownOwner ?? '<unknown>'}`);
    if (groupService.has(consumer?.consumerGroup)) {
      add(errors, groupService.get(consumer.consumerGroup) === consumer.service, `${consumer.consumerGroup} cannot map to multiple services`);
    } else {
      groupService.set(consumer?.consumerGroup, consumer?.service);
    }
  }
  add(errors, duplicates(consumerGroups).length === 0, `${label} duplicates consumer groups: ${duplicates(consumerGroups).join(', ')}`);
  add(errors, JSON.stringify(consumerGroups) === JSON.stringify(routeByEvent.get(label)?.consumerGroups ?? []), `${label} consumers and order must match the B26 static routing seed`);

  exactKeys(errors, governance.transport, ['protocol', 'topic', 'partitionKey', 'aggregateIdSource', 'delivery', 'bindingVersion', 'channelId'], `${label}.transport`);
  const route = routeByEvent.get(label);
  const topic = topicByName.get(route?.topic);
  add(errors, isRecord(route), `${label} must have one B26 static routing record`);
  add(errors, isRecord(topic), `${label} route must reference a declared B26 topic`);
  add(errors, governance.producer?.service === topic?.ownerService, `${label} producer must match the B26 topic owner`);
  add(errors, topic?.producerPrincipal === `svc.${governance.producer?.service}`, `${label} producer principal must match its service identity`);
  add(errors, governance.transport?.protocol === 'kafka', `${label} protocol must be kafka`);
  add(errors, governance.transport?.topic === route?.topic, `${label} topic must match the B26 static routing seed`);
  add(errors, governance.transport?.partitionKey === 'aggregateId', `${label} partitionKey must be aggregateId`);
  add(errors, governance.transport?.aggregateIdSource === `payload.${event.aggregateIdField}`, `${label} aggregateIdSource must match aggregateIdField`);
  add(errors, governance.transport?.delivery === 'at-least-once', `${label} delivery must be at-least-once`);
  add(errors, governance.transport?.bindingVersion === '0.5.0', `${label} Kafka bindingVersion must be 0.5.0`);
  add(errors, governance.transport?.channelId === normalizedEventName, `${label} channelId must be canonical and deterministic`);
  add(errors, !usedIds.has(governance.transport?.channelId), `${label} channelId is duplicated`);
  usedIds.add(governance.transport?.channelId);

  exactKeys(errors, governance.schema, ['schemaVersion', 'payloadRef', 'compatibility'], `${label}.schema`);
  add(errors, governance.schema?.schemaVersion === event.schema, `${label} governed schemaVersion must match event schema`);
  add(errors, governance.schema?.payloadRef === event.payloadSchema?.$ref, `${label} governed payloadRef must match event payloadSchema`);
  add(errors, governance.schema?.compatibility === event.compatibility?.strategy && governance.schema?.compatibility === 'additive', `${label} compatibility must be additive and match the event`);
  const payload = resolveLocalReference(catalog, event.payloadSchema?.$ref);
  add(errors, isRecord(payload) && isRecord(payload.properties) && Object.hasOwn(payload.properties, event.aggregateIdField), `${label} aggregateIdField must exist in its payload schema`);
  if (label === PLACEMENT_COMPLETED_EVENT) checkPlacementCompletedPayload(payload, errors);

  add(errors, JSON.stringify(governance.correlation) === JSON.stringify(REQUIRED_CORRELATION), `${label} correlation fields must be exact and ordered`);
  add(errors, JSON.stringify(event['x-envelope-required']) === JSON.stringify(REQUIRED_ENVELOPE), `${label} must require the complete canonical envelope`);
  const expectedTraceability = M1016_EVENT_TRACEABILITY.get(label) ?? ['ARCH-EVT-001', 'INT-P1-017'];
  add(errors, JSON.stringify(governance.traceability) === JSON.stringify(expectedTraceability), `${label} traceability must match its frozen integration journey`);
  add(errors, event['x-kafka'] === undefined, `${label} must not retain duplicate x-kafka metadata`);
}

function payloadFieldSchema(payload, field) {
  return payload?.properties?.[field];
}

function isRequiredPayloadField(payload, field) {
  return Array.isArray(payload?.required) && payload.required.includes(field) && isRecord(payloadFieldSchema(payload, field));
}

function isEnvelopeField(field) {
  return REQUIRED_ENVELOPE.includes(field);
}

function checkProfileFieldOrigins({ fields, origins, payload, derivedFieldMappings, allowDerived, label, kind }, errors) {
  const fieldSet = [...fields].sort();
  const originKeys = Object.keys(origins ?? {}).sort();
  add(errors, JSON.stringify(originKeys) === JSON.stringify(fieldSet), `${label} ${kind} field-origin mapping must cover exactly its declared fields`);
  for (const field of fields) {
    const origin = origins?.[field];
    if (origin === 'ENVELOPE') {
      add(errors, isEnvelopeField(field), `${label} ${kind} field ${field} marked ENVELOPE must be a canonical envelope field`);
      continue;
    }
    if (origin === 'PAYLOAD') {
      add(errors, isRequiredPayloadField(payload, field), `${label} ${kind} field ${field} marked PAYLOAD must be a required canonical payload property`);
      continue;
    }
    const derivedField = typeof origin === 'string' && origin.startsWith(TRUSTED_COMPLETION_DERIVED_ORIGIN_PREFIX)
      ? origin.slice(TRUSTED_COMPLETION_DERIVED_ORIGIN_PREFIX.length)
      : undefined;
    const isExplicitServerDerived = allowDerived
      && derivedField === field
      && stableJson(derivedFieldMappings?.[derivedField]) === stableJson(TRUSTED_COMPLETION_DERIVED_FIELD_MAPPINGS[derivedField]);
    add(errors, isExplicitServerDerived, `${label} ${kind} field ${field} must be canonical ENVELOPE/PAYLOAD or the one explicit server-derived mapping`);
  }
}

function schemaAllowsExactValue(schema, expected) {
  if (!isRecord(schema)) return false;
  if (isRecord(expected)) {
    if (!isRecord(schema.properties)) return false;
    if (!Array.isArray(schema.required) || !Object.keys(expected).every((field) => schema.required.includes(field))) return false;
    return Object.entries(expected).every(([field, value]) => schemaAllowsExactValue(schema.properties[field], value));
  }
  if (Object.hasOwn(schema, 'const')) return stableJson(schema.const) === stableJson(expected);
  return Array.isArray(schema.enum) && schema.enum.some((candidate) => stableJson(candidate) === stableJson(expected));
}

function schemaBranchAllowsPredicate(schema, predicate) {
  return isRecord(schema?.properties) && Object.entries(predicate).every(([field, expected]) => schemaAllowsExactValue(schema.properties[field], expected));
}

function hasClosedPredicateBranch(payload, predicate) {
  if (schemaBranchAllowsPredicate(payload, predicate)) return true;
  return (payload?.oneOf ?? []).some((branch) => schemaBranchAllowsPredicate(branch, predicate));
}

function hasOneOfPredicateBranch(payload, predicate) {
  return (payload?.oneOf ?? []).some((branch) => schemaBranchAllowsPredicate(branch, predicate));
}

function checkTrustedProfilePayload(profile, catalogEvent, catalog, derivedFieldMappings, errors) {
  const payload = resolveLocalReference(catalog, catalogEvent?.payloadSchema?.$ref);
  const label = `M1-014 trusted source ${profile.eventName}`;
  add(errors, isRecord(payload) && payload.additionalProperties === false, `${label} payload must be a closed canonical object`);
  if (!isRecord(payload)) return;

  checkProfileFieldOrigins({
    fields: profile.lineageFields,
    origins: profile.lineageFieldOrigins,
    payload,
    derivedFieldMappings,
    allowDerived: false,
    label,
    kind: 'lineage',
  }, errors);
  checkProfileFieldOrigins({
    fields: profile.dedupeFields,
    origins: profile.dedupeFieldOrigins,
    payload,
    derivedFieldMappings,
    allowDerived: true,
    label,
    kind: 'dedupe',
  }, errors);
  for (const field of Object.keys(profile.qualifiedPredicate ?? {})) {
    const isExplicitDerivedPredicate = profile.id === 'MASTERY_MILESTONE' && field === 'stateTransition';
    add(errors, isExplicitDerivedPredicate || isRequiredPayloadField(payload, field), `${label} predicate field ${field} must be a required canonical payload property or the sole explicit derived predicate`);
  }

  if (profile.id === 'MASTERY_MILESTONE') {
    const { stateTransition, masteryStageAfter, d7Gate } = profile.qualifiedPredicate;
    add(errors, stableJson(stateTransition) === stableJson(MASTERY_MILESTONE_DERIVED_TRANSITION), `${label} must require the sole explicit derived stateTransition predicate`);
    add(errors, isRequiredPayloadField(payload, 'masteryStageBefore') && isRequiredPayloadField(payload, 'masteryStageAfter'), `${label} stateTransition must derive only from required masteryStageBefore/masteryStageAfter payload fields`);
    add(errors, Array.isArray(masteryStageAfter) && masteryStageAfter.length === 2, `${label} masteryStageAfter predicate must enumerate the exact two milestone stages`);
    for (const stage of masteryStageAfter ?? []) {
      add(errors, hasOneOfPredicateBranch(payload, { masteryStageAfter: stage, d7Gate }), `${label} must encode ${stage} with the exact D7-passed predicate in a closed payload branch`);
    }
    const d7GateSchema = payloadFieldSchema(payload, 'd7Gate');
    const d7Fields = Object.keys(d7Gate ?? {});
    const d7FieldsRequired = Array.isArray(d7GateSchema?.required)
      && d7Fields.every((field) => d7GateSchema.required.includes(field));
    const hasD7PassedBranch = (d7GateSchema?.oneOf ?? [])
      .some((branch) => schemaBranchAllowsPredicate(branch, d7Gate));
    add(errors, d7FieldsRequired && hasD7PassedBranch, `${label} must encode the exact D7-passed result/reason branch`);
  } else if (profile.id === 'TASK_COMPLETED') {
    for (const [field, expected] of Object.entries(profile.qualifiedPredicate)) {
      add(errors, stableJson(payloadFieldSchema(payload, field)?.const) === stableJson(expected), `${label} predicate ${field} must be an exact payload const`);
    }
  } else if (profile.id === 'ASSESSMENT_ITEM_CORRECT') {
    add(errors, hasOneOfPredicateBranch(payload, profile.qualifiedPredicate), `${label} predicate must be encoded by an exact objective-correct, not-guessed payload branch`);
  } else {
    add(errors, hasClosedPredicateBranch(payload, profile.qualifiedPredicate), `${label} predicate must be encoded by an exact closed canonical payload branch`);
  }
}

function checkTrustedCompletionPolicy(policy, catalog, routeByEvent, errors) {
  const trustedCompletion = policy?.trustedCompletion;
  exactKeys(errors, trustedCompletion, ['tupleFields', 'lineageRequiredFields', 'derivedFieldMappings', 'receiptFields', 'sourceProfiles', 'rejectedEventNames', 'rejectedCanonicalEvents', 'rejectionReasons'], 'M1-014 trustedCompletion policy');
  if (!isRecord(trustedCompletion)) return;
  add(errors, JSON.stringify(trustedCompletion.tupleFields) === JSON.stringify(TRUSTED_COMPLETION_TUPLE_FIELDS), 'M1-014 trustedCompletion tuple fields must be exact and ordered');
  add(errors, JSON.stringify(trustedCompletion.lineageRequiredFields) === JSON.stringify(TRUSTED_COMPLETION_LINEAGE_FIELDS), 'M1-014 trustedCompletion lineage fields must be exact and ordered');
  add(errors, stableJson(trustedCompletion.derivedFieldMappings) === stableJson(TRUSTED_COMPLETION_DERIVED_FIELD_MAPPINGS), 'M1-014 trustedCompletion derived field mappings must be exact and server-owned');
  add(errors, JSON.stringify(trustedCompletion.receiptFields) === JSON.stringify(TRUSTED_COMPLETION_RECEIPT_FIELDS), 'M1-014 trustedCompletion receipt fields must be exact and ordered');
  add(errors, Array.isArray(trustedCompletion.sourceProfiles) && trustedCompletion.sourceProfiles.length === EXPECTED_TRUSTED_COMPLETION_PROFILES.length, 'M1-014 trustedCompletion source profiles must contain the exact three approved profiles');

  const catalogByEventName = new Map((catalog.events ?? []).map((event) => [event?.eventName, event]));
  for (const [index, expected] of EXPECTED_TRUSTED_COMPLETION_PROFILES.entries()) {
    const profile = trustedCompletion.sourceProfiles?.[index];
    exactKeys(errors, profile, ['id', 'producerService', 'eventName', 'schemaVersion', 'qualifiedPredicate', 'lineageFields', 'lineageFieldOrigins', 'dedupeFields', 'dedupeFieldOrigins', 'maturity'], `M1-014 trustedCompletion.sourceProfiles[${index}]`);
    add(errors, stableJson(profile) === stableJson(expected), `M1-014 trustedCompletion source profile ${expected.id} must exactly match the approved producer, tuple, predicate, lineage and dedupe rule`);
    add(errors, TRUSTED_COMPLETION_LINEAGE_FIELDS.every((field) => profile?.lineageFields?.includes(field)), `M1-014 trustedCompletion source profile ${expected.id} must contain every common lineage field`);
    const catalogEvent = catalogByEventName.get(expected.eventName);
    const route = routeByEvent.get(expected.eventName);
    add(errors, catalogEvent?.status === CANONICAL_STATUS, `M1-014 trusted source ${expected.eventName} must be CANONICAL_D2`);
    add(errors, catalogEvent?.['x-p1r-governance']?.producer?.service === expected.producerService, `M1-014 trusted source ${expected.eventName} producer must match its approved profile`);
    add(errors, JSON.stringify(route?.consumerGroups) === JSON.stringify(TRUSTED_COMPLETION_ROUTING[expected.eventName]), `M1-014 trusted source ${expected.eventName} B26 consumer binding must be exact`);
    checkTrustedProfilePayload(expected, catalogEvent, catalog, trustedCompletion.derivedFieldMappings, errors);
  }

  add(errors, JSON.stringify(trustedCompletion.rejectedEventNames) === JSON.stringify(TRUSTED_COMPLETION_REJECTED_EVENT_NAMES), 'M1-014 trustedCompletion rejected event names must be exact and ordered');
  add(errors, stableJson(trustedCompletion.rejectedCanonicalEvents) === stableJson(TRUSTED_COMPLETION_REJECTED_CANONICAL_EVENTS), 'M1-014 trustedCompletion rejected canonical events must preserve the queue-fact exclusion');
  add(errors, stableJson(trustedCompletion.rejectionReasons) === stableJson(TRUSTED_COMPLETION_REJECTION_REASONS), 'M1-014 trustedCompletion rejection reasons must be exact');
  const approvedSourceNames = new Set((trustedCompletion.sourceProfiles ?? []).map((profile) => profile?.eventName));
  add(errors, !approvedSourceNames.has('learning.review.scheduled.v2'), 'M1-014 review scheduling cannot be an approved reward source');
  const reviewRoute = routeByEvent.get('learning.review.scheduled.v2');
  add(errors, !reviewRoute?.consumerGroups?.includes('cg.gamification-from-learning.v1'), 'M1-014 review scheduling must not bind gamification');
}

export function validateEventGovernanceData({ catalog, ownerPolicy, b26Runtime, gamificationSocialPolicy, fragments = [], checkProjection = true } = {}) {
  const errors = [];
  add(errors, isRecord(catalog), 'event catalog must be an object');
  add(errors, isRecord(ownerPolicy), 'data ownership policy must be an object');
  add(errors, isRecord(b26Runtime), 'B26 static candidate must be an object');
  if (errors.length > 0) return { result: 'FAIL', errors };

  checkPlatformGovernance(catalog, errors);
  add(errors, b26Runtime.mode === 'static-only' && b26Runtime.runtimeStatus === 'pending' && b26Runtime.defaultDecision === 'NO-GO', 'B26 input must remain static-only, pending and NO-GO');
  add(errors, Array.isArray(catalog.events) && catalog.events.length === 183, 'event catalog must contain exactly 183 current candidates');

  const services = new Set((ownerPolicy.serviceOwners ?? []).map((owner) => owner.service));
  const dataOwners = new Set((ownerPolicy.serviceOwners ?? []).filter((owner) => owner.dataOwner === true).map((owner) => owner.service));
  const topicNames = (b26Runtime.topics ?? []).map((topic) => topic?.name);
  add(errors, duplicates(topicNames).length === 0, `B26 duplicates topic names: ${duplicates(topicNames).join(', ')}`);
  const topicByName = new Map((b26Runtime.topics ?? []).map((topic) => [topic.name, topic]));
  const groupNames = (b26Runtime.topics ?? []).flatMap((topic) => (topic.consumerGroups ?? []).map((group) => group?.name));
  add(errors, duplicates(groupNames).length === 0, `B26 duplicates consumer group names: ${duplicates(groupNames).join(', ')}`);
  const routeNames = (b26Runtime.eventRouting ?? []).map((route) => route?.eventName);
  add(errors, duplicates(routeNames).length === 0, `B26 duplicates event routes: ${duplicates(routeNames).join(', ')}`);
  add(errors, JSON.stringify([...routeNames].sort()) === JSON.stringify(EXPECTED_CANONICAL_EVENTS), 'B26 event routing must cover the exact forty-two canonical governance events');
  const routeByEvent = new Map((b26Runtime.eventRouting ?? []).map((route) => [route.eventName, route]));
  if (gamificationSocialPolicy !== undefined) checkTrustedCompletionPolicy(gamificationSocialPolicy, catalog, routeByEvent, errors);
  const eventNames = (catalog.events ?? []).map((event) => event?.eventName);
  add(errors, duplicates(eventNames).length === 0, `event catalog duplicates event names: ${duplicates(eventNames).join(', ')}`);

  const canonicalNames = [];
  const counts = { canonical: 0, historical: 0, deprecated: 0 };
  const usedIds = new Set();
  const groupService = new Map();
  for (const [index, event] of (catalog.events ?? []).entries()) {
    const label = `events[${index}]`;
    add(errors, isRecord(event), `${label} must be an object`);
    if (!isRecord(event)) continue;
    add(errors, EXPECTED_STATUSES.includes(event.status), `${event.eventName ?? label} has an unsupported governance status`);
    const expectedEventKeys = [
      ...BASE_EVENT_KEYS,
      ...(event['x-envelope-required'] === undefined ? [] : ['x-envelope-required']),
      ...(event.status === CANONICAL_STATUS ? ['x-p1r-governance'] : []),
      ...(event.status === DEPRECATED_STATUS ? ['x-p1r-deprecation'] : []),
    ];
    exactKeys(errors, event, expectedEventKeys, `${event.eventName ?? label}`);
    if (event.status === CANONICAL_STATUS) {
      counts.canonical += 1;
      canonicalNames.push(event.eventName);
      checkCanonicalEvent({ event, catalog, services, dataOwners, routeByEvent, topicByName, usedIds, groupService }, errors);
    } else if (event.status === HISTORICAL_STATUS) {
      counts.historical += 1;
      add(errors, event['x-p1r-governance'] === undefined, `${event.eventName} historical candidate cannot carry active v2 governance`);
      add(errors, event['x-kafka'] === undefined, `${event.eventName} historical candidate cannot carry active Kafka metadata`);
    } else if (event.status === DEPRECATED_STATUS) {
      counts.deprecated += 1;
      add(errors, isRecord(event['x-p1r-deprecation']), `${event.eventName} deprecated event requires migration metadata`);
    }
  }
  add(errors, JSON.stringify(canonicalNames.sort()) === JSON.stringify(EXPECTED_CANONICAL_EVENTS), 'CANONICAL_D2 set must be the exact forty-two governed events');
  add(errors, counts.canonical === 42 && counts.historical === 141 && counts.deprecated === 0, 'event status counts must be 42 canonical / 141 historical / 0 deprecated');

  const fragmentInventory = catalog['x-p1r-event-governance']?.fragmentInventory ?? [];
  const inventoryPaths = fragmentInventory.map((fragment) => fragment?.path);
  const normalizedFragments = fragments.map((fragment) => ({
    ...fragment,
    path: String(fragment.path).replaceAll('\\', '/'),
  }));
  const fragmentPaths = normalizedFragments.map((fragment) => fragment.path);
  add(errors, duplicates(fragmentPaths).length === 0, `event fragments duplicate paths: ${duplicates(fragmentPaths).join(', ')}`);
  add(errors, JSON.stringify([...fragmentPaths].sort()) === JSON.stringify([...inventoryPaths].sort()), 'event fragment files must exactly match catalog fragmentInventory');
  const fragmentByPath = new Map(normalizedFragments.map((fragment) => [fragment.path, fragment]));
  const catalogEventNames = new Set(eventNames);
  for (const [index, inventory] of fragmentInventory.entries()) {
    const fragment = fragmentByPath.get(inventory.path);
    const actualNames = (fragment?.data?.events ?? []).map((event) => event?.eventName);
    add(errors, isRecord(fragment?.data), `${inventory.path} must exist and contain an object`);
    add(errors, duplicates(actualNames).length === 0, `${inventory.path} duplicates event names: ${duplicates(actualNames).join(', ')}`);
    add(errors, JSON.stringify(actualNames) === JSON.stringify(inventory.eventNames), `${inventory.path} events must exactly match fragmentInventory[${index}] in order`);
    add(errors, (inventory.eventNames ?? []).every((eventName) => catalogEventNames.has(eventName)), `${inventory.path} fragmentInventory contains an event absent from the catalog`);
  }

  for (const fragment of normalizedFragments) {
    add(errors, isRecord(fragment.data), `${fragment.path} must be an object`);
    add(errors, fragment.data?.asyncapi === undefined, `${fragment.path} must not define a second AsyncAPI source`);
    add(errors, fragment.data?.status === undefined, `${fragment.path} must not define a root event status`);
    add(errors, fragment.data?.['x-p1r-event-governance'] === undefined, `${fragment.path} must not define root platform event governance`);
    add(errors, fragment.data?.['x-p1r-governance'] === undefined, `${fragment.path} must not define root event governance`);
    add(errors, fragment.data?.['x-kafka'] === undefined, `${fragment.path} must not define root Kafka governance`);
    const payloadSchemas = fragment.data?.payloadSchemas;
    errors.push(...validateEventPayloadSchemas(payloadSchemas, `${fragment.path} payloadSchemas`));
    const locallyReferencedPayloadSchemas = new Set();
    for (const event of fragment.data?.events ?? []) {
      const eventLabel = `${fragment.path}:${event?.eventName ?? '(missing eventName)'}`;
      add(errors, event?.status === undefined, `${eventLabel} must not define catalog-owned status`);
      add(errors, event?.['x-p1r-governance'] === undefined, `${eventLabel} must not define catalog-owned governance`);
      add(errors, event?.['x-kafka'] === undefined, `${eventLabel} must not define duplicate Kafka governance`);
      const referenceErrors = validateExactEventPayloadReference(event?.payloadSchema, payloadSchemas, `${eventLabel} payloadSchema`);
      errors.push(...referenceErrors);
      if (referenceErrors.length === 0) locallyReferencedPayloadSchemas.add(eventPayloadSchemaName(event.payloadSchema));
    }
    if (isRecord(payloadSchemas)) {
      for (const schemaName of Object.keys(payloadSchemas)) {
        add(errors, locallyReferencedPayloadSchemas.has(schemaName), `${fragment.path} local payload schema ${schemaName} must be referenced by an event in the same fragment`);
      }
    }
  }

  if (checkProjection) {
    try {
      const projectedCatalog = structuredClone(catalog);
      projectCanonicalAsyncApi(projectedCatalog);
      add(errors, stableJson(catalog.asyncapi) === stableJson(projectedCatalog.asyncapi), 'embedded AsyncAPI must be the exact canonical governance projection');
    } catch (error) {
      errors.push(`embedded AsyncAPI projection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    summary: {
      totalEvents: catalog.events?.length ?? 0,
      canonicalEvents: counts.canonical,
      historicalCandidates: counts.historical,
      deprecatedEvents: counts.deprecated,
      canonicalConsumerBindings: (catalog.events ?? []).filter((event) => event.status === CANONICAL_STATUS)
        .reduce((total, event) => total + (event['x-p1r-governance']?.consumers?.length ?? 0), 0),
      ...countEventGapClosures(catalog['x-p1r-event-governance']?.plannedClosures),
      runtimeStatus: catalog['x-p1r-event-governance']?.runtimeStatus,
      asyncApiChannels: Object.keys(catalog.asyncapi?.channels ?? {}).length,
      asyncApiOperations: Object.keys(catalog.asyncapi?.operations ?? {}).length,
    },
    errors,
  };
}

export function validateEventGovernance({ root = defaultRoot } = {}) {
  const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8'));
  return validateEventGovernanceData({
    catalog: read('packages/contracts/events/v1/catalog.json'),
    ownerPolicy: read('config/p1r-data-ownership.v1.json'),
    b26Runtime: read('config/b26-event-runtime.json'),
    gamificationSocialPolicy: read('config/p1r-gamification-social-contract.v1.json'),
    fragments: listEventFragments(root),
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const report = validateEventGovernance();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`P1R event governance static/D2 ${report.result} (${report.summary?.canonicalEvents ?? 0} canonical, ${report.summary?.historicalCandidates ?? 0} historical, ${report.summary?.canonicalConsumerBindings ?? 0} consumer bindings, runtimeStatus=${report.summary?.runtimeStatus ?? 'UNKNOWN'}).`);
      for (const error of report.errors) console.error(`- ${error}`);
    }
    if (report.result !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
