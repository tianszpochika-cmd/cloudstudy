import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isHttpMethod, isRecord, readJson, resolveJsonPointer } from './schema-utils.mjs';
import { validateEventPayloadSchemas } from './event-catalog-policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const defaults = {
  openapi: path.join(repoRoot, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json'),
  events: path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'catalog.json'),
  schema: path.join(repoRoot, 'packages', 'contracts', 'schemas', 'v1', 'registry.json'),
};

export const M1008_CONTENT_PROMOTION_ID = 'M1-008_CONTENT_LIFECYCLE_PROMOTION';
export const M1008_SOURCE_CONTRACT_BASELINE_REF = '6ce98a95b75e7efca05cc511f5f773dbf2be08a4';
export const M1008_IMMUTABLE_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const M1008_CONTENT_EVENT_NAMES = Object.freeze([
  'content.version.submitted.v1',
  'content.version.reviewed.v1',
  'content.version.published.v1',
  'content.version.unpublished.v1',
  'content.version.rolled_back.v1',
]);
export const M1008_REVIEWED_EVENT_PAYLOAD_SCHEMA = Object.freeze({
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
    reviewStage: { type: 'string', enum: ['FIRST_REVIEW', 'FINAL_REVIEW'] },
    decision: { type: 'string', enum: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'] },
    reviewVersion: { type: 'integer', minimum: 1 },
    reviewedAt: { type: 'string', format: 'date-time' },
  },
});
export const M1008_REVIEWED_EVENT_COMPATIBILITY = Object.freeze({
  strategy: 'additive',
  breakingChange: 'publish content.version.reviewed.v2',
  consumerRule: '双审阶段按 contentVersionId/contentHash/reviewStage/reviewVersion 去重；作者不得作为自己的审核者。',
});
export const M1008_CONTENT_AGGREGATE_ID_FIELDS = Object.freeze({
  'content.version.submitted.v1': 'contentVersionId',
  'content.version.reviewed.v1': 'contentVersionId',
  'content.version.published.v1': 'contentVersionId',
  'content.version.unpublished.v1': 'contentVersionId',
  'content.version.rolled_back.v1': 'contentCode',
});
export const M1008_CONTENT_CONSUMERS = Object.freeze({
  'content.version.submitted.v1': Object.freeze([
    Object.freeze({ service: 'admin-ops-service', consumerGroup: 'cg.admin-ops-from-content.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-content.v1' }),
  ]),
  'content.version.reviewed.v1': Object.freeze([
    Object.freeze({ service: 'admin-ops-service', consumerGroup: 'cg.admin-ops-from-content.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-content.v1' }),
  ]),
  'content.version.published.v1': Object.freeze([
    Object.freeze({ service: 'learner-service', consumerGroup: 'cg.learner-from-content.v1' }),
    Object.freeze({ service: 'learning-service', consumerGroup: 'cg.learning-from-content.v1' }),
    Object.freeze({ service: 'assessment-service', consumerGroup: 'cg.assessment-from-content.v1' }),
    Object.freeze({ service: 'admin-ops-service', consumerGroup: 'cg.admin-ops-from-content.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-content.v1' }),
  ]),
  'content.version.unpublished.v1': Object.freeze([
    Object.freeze({ service: 'learner-service', consumerGroup: 'cg.learner-from-content.v1' }),
    Object.freeze({ service: 'learning-service', consumerGroup: 'cg.learning-from-content.v1' }),
    Object.freeze({ service: 'assessment-service', consumerGroup: 'cg.assessment-from-content.v1' }),
    Object.freeze({ service: 'admin-ops-service', consumerGroup: 'cg.admin-ops-from-content.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-content.v1' }),
  ]),
  'content.version.rolled_back.v1': Object.freeze([
    Object.freeze({ service: 'learner-service', consumerGroup: 'cg.learner-from-content.v1' }),
    Object.freeze({ service: 'learning-service', consumerGroup: 'cg.learning-from-content.v1' }),
    Object.freeze({ service: 'assessment-service', consumerGroup: 'cg.assessment-from-content.v1' }),
    Object.freeze({ service: 'admin-ops-service', consumerGroup: 'cg.admin-ops-from-content.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-content.v1' }),
  ]),
});
export const M1008_CANONICAL_ENVELOPE = Object.freeze([
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
  'schemaVersion',
  'dedupeKey',
  'payload',
]);
export const M1008_CONTENT_GAP_IDS = Object.freeze([
  'EVENT-GAP-CONTENT-DUPLICATE',
  'EVENT-GAP-BIND-CONT-001',
]);
export const M1008_OPENAPI_SOURCE_SEMANTIC_SHA256 = 'a873b367761fb59e44ea46181199da1605ba0a124973cface6c035e90291f79b';
// The projection fingerprint includes the exact post-merge B1/B9/B10 artifact,
// including additions that the legacy comparator intentionally does not walk
// (new paths, schemas and operation extensions). This keeps the allowance
// finite without embedding a megabyte-sized OpenAPI snapshot in this script.
export const M1008_OPENAPI_EXPECTED_SEMANTIC_SHA256 = 'e6a0cb64034fd8d921ef90b86e1eac20908b56e8ddee5d65ac7257dbb2320e1c';
const M1008_OPENAPI_APPROVED_PATH_PROJECTIONS = Object.freeze([
  '/api/v1/content',
  '/api/v1/content/{contentId}/versions',
  '/api/v1/content/{contentId}/versions/{versionId}/submit',
  '/api/v1/content/{contentId}/versions/{versionId}/review',
  '/api/v1/content/{contentId}/versions/{versionId}/publish',
  '/api/v1/content/{contentId}/versions/{versionId}/archive',
  '/api/v1/content/{contentId}/versions/{versionId}/restore',
  '/api/v1/content/imports',
  '/api/v1/public/content/catalog',
  '/api/v1/admin/content-publish-tasks/{taskId}',
  '/internal/v1/content/assessment-snapshots/{contentVersionId}/recovery',
]);
const M1008_OPENAPI_APPROVED_PARAMETER_PROJECTIONS = Object.freeze([
  'B1ContentRole',
  'B9ScheduledPublishTaskQuery',
  'B9ScheduledPublishTaskId',
]);
const M1008_OPENAPI_APPROVED_SCHEMA_PROJECTIONS = Object.freeze([
  'B1CreateContentRequest',
  'B1CreateVersionRequest',
  'B1ActorRequest',
  'B1ActorReasonRequest',
  'B1ReviewDecisionRequest',
  'B1ImportRequest',
  'B9ContentVersionSummary',
  'B9ContentCommandRequest',
  'B9ContentCommandAccepted',
  'B9PublicContentProjection',
  'B9LearnerContentProjection',
  'B9PublicContentCard',
  'B9PublicProjectionState',
  'B9AdminContentState',
  'B9PublishScheduleInput',
  'B9ScheduledPublishTask',
  'B9ScheduledPublishTaskRef',
  'B9SessionContentPin',
  'B9ScheduledPublishTaskResponse',
  'B9OffsetDateTime',
  'B9ScheduledPublishTaskId',
  'B9DisplayTimeZone',
  'B9ContentValidationReportId',
  'B9RightsSnapshotId',
  'B9AuditId',
  'B9EvidenceVersion',
  'B10ContentVersionPin',
  'B10ActiveSessionAttemptPin',
  'B10RuleContract',
  'B10ContentRecovery',
  'B10AssessmentSession',
  'B10Attempt',
  'B10AssessmentReport',
  'B10MasteryProjection',
]);
const M1008_OPENAPI_APPROVED_ROOT_PROJECTIONS = Object.freeze([
  'x-p1r-gateway-boundary',
]);
export const M1008_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ["POST /api/v1/content.request.description", "description contract changed"],
  ["POST /api/v1/content.request.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content.request.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content.request.properties.actorId.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions.request.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions.request.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions.request.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions.request.properties.actorId.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/submit.request.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/submit.request.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/submit.request.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/submit.request.properties.actorId.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/review.request.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/review.request.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/review.request.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/review.request.properties.reviewerId.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/publish.request.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/publish.request.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/publish.request.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/publish.request.properties.actorId.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/archive.request.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/archive.request.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/archive.request.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/restore.request.description", "description contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/restore.request.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/restore.request.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/imports.request.description", "description contract changed"],
  ["POST /api/v1/content/imports.request.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/imports.request.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["POST /api/v1/content/imports.request.properties.actorId.description", "description contract changed"],
  ["POST /api/v1/admin/content-commands.request.oneOf", "oneOf contract changed"],
  ["POST /api/v1/admin/content-commands.request.x-command-field-policy", "unknown schema keyword or extension changed"],
  ["POST /api/v1/admin/content-commands.request.properties.command.enum", "new enum value added: SCHEDULE_PUBLISH"],
  ["POST /api/v1/admin/content-commands.request.properties.command.enum", "new enum value added: CANCEL_SCHEDULED_PUBLISH"],
  ["components.schemas.B1CreateContentRequest.description", "description contract changed"],
  ["components.schemas.B1CreateContentRequest.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["components.schemas.B1CreateContentRequest.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["components.schemas.B1CreateContentRequest.properties.actorId.description", "description contract changed"],
  ["components.schemas.B1CreateVersionRequest.description", "description contract changed"],
  ["components.schemas.B1CreateVersionRequest.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["components.schemas.B1CreateVersionRequest.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["components.schemas.B1CreateVersionRequest.properties.actorId.description", "description contract changed"],
  ["components.schemas.B1ActorRequest.description", "description contract changed"],
  ["components.schemas.B1ActorRequest.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["components.schemas.B1ActorRequest.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["components.schemas.B1ActorRequest.properties.actorId.description", "description contract changed"],
  ["components.schemas.B1ActorReasonRequest.description", "description contract changed"],
  ["components.schemas.B1ActorReasonRequest.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["components.schemas.B1ActorReasonRequest.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["components.schemas.B1ReviewDecisionRequest.description", "description contract changed"],
  ["components.schemas.B1ReviewDecisionRequest.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["components.schemas.B1ReviewDecisionRequest.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["components.schemas.B1ReviewDecisionRequest.properties.reviewerId.description", "description contract changed"],
  ["components.schemas.B1ImportRequest.description", "description contract changed"],
  ["components.schemas.B1ImportRequest.x-compatibility-only", "unknown schema keyword or extension changed"],
  ["components.schemas.B1ImportRequest.x-authority-inputs-ignored", "unknown schema keyword or extension changed"],
  ["components.schemas.B1ImportRequest.properties.actorId.description", "description contract changed"],
  ["components.schemas.B9ContentVersionSummary.description", "description contract changed"],
  ["components.schemas.B9ContentVersionSummary.x-canonical-persistent-statuses", "unknown schema keyword or extension changed"],
  ["components.schemas.B9ContentVersionSummary.x-deprecated-compatibility-statuses", "unknown schema keyword or extension changed"],
  ["components.schemas.B9ContentVersionSummary.properties.status.description", "description contract changed"],
  ["components.schemas.B9ContentVersionSummary.properties.status.x-deprecated-values", "unknown schema keyword or extension changed"],
  ["components.schemas.B9ContentCommandRequest.oneOf", "oneOf contract changed"],
  ["components.schemas.B9ContentCommandRequest.x-command-field-policy", "unknown schema keyword or extension changed"],
  ["components.schemas.B9ContentCommandRequest.properties.command.enum", "new enum value added: SCHEDULE_PUBLISH"],
  ["components.schemas.B9ContentCommandRequest.properties.command.enum", "new enum value added: CANCEL_SCHEDULED_PUBLISH"],
  ["components.schemas.B9ContentCommandAccepted.description", "description contract changed"],
  ["components.schemas.B9ContentCommandAccepted.x-server-generated-fields", "unknown schema keyword or extension changed"],
  ["components.schemas.B9ContentCommandAccepted.properties.command.enum", "enum contract changed from unspecified to specified"],
  ["components.schemas.B9ContentCommandAccepted.properties.command.readOnly", "readOnly contract changed"],
  ["components.schemas.B9PublicContentProjection.properties.availability.description", "description contract changed"],
  ["components.schemas.B9PublicProjectionState.description", "description contract changed"],
  ["components.schemas.B9AdminContentState.description", "description contract changed"],
  ["components.schemas.B9AdminContentState.x-canonical-persistent-statuses", "unknown schema keyword or extension changed"],
  ["components.schemas.B9AdminContentState.x-deprecated-compatibility-statuses", "unknown schema keyword or extension changed"],
  ["components.schemas.B9AdminContentState.properties.latestStatus.description", "description contract changed"],
  ["components.schemas.B9AdminContentState.properties.latestStatus.x-deprecated-values", "unknown schema keyword or extension changed"],
  ["components.schemas.B9AdminContentState.properties.reviewStages", "existing property removed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/publish.x-idempotency", "operation x-idempotency contract changed"],
  ["POST /api/v1/content/{contentId}/versions/{versionId}/archive.x-idempotency", "operation x-idempotency contract changed"],
  ["components.schemas.B9PublicContentProjection.properties.availability.enum", "enum contract changed from unspecified to specified"],
  ["components.schemas.B9PublicContentProjection.properties.availability.const", "const contract changed"],
  ["components.schemas.B9PublicContentCard.properties.availability.enum", "enum contract changed from unspecified to specified"],
  ["components.schemas.B9PublicContentCard.properties.availability.const", "const contract changed"],
  ["components.schemas.B10ContentVersionPin.description", "description contract changed"],
  ["components.schemas.B10ContentVersionPin.readOnly", "readOnly contract changed"],
  ["components.schemas.B10ContentVersionPin.oneOf", "oneOf contract changed"],
  ["components.schemas.B10ContentVersionPin.x-p1r-pin-scope-policy", "unknown schema keyword or extension changed"],
  ["components.schemas.B10ContentVersionPin.properties.fallbackVersionId.nullable", "nullable contract changed"],
  ["components.schemas.B10ContentVersionPin.properties.recoveryReasonCode.enum", "new enum value added: RIGHTS_REMOVED"],
  ["components.schemas.B10ContentVersionPin.properties.recoveryReasonCode.enum", "new enum value added: SECURITY_REMOVED"],
  ["components.schemas.B10ContentVersionPin.properties.recoveryReasonCode.enum", "new enum value added: LEGAL_REMOVED"],
  ["components.schemas.B10RuleContract.properties.sealed.enum", "enum contract changed from unspecified to specified"],
  ["components.schemas.B10RuleContract.properties.sealed.const", "const contract changed"],
  ["components.schemas.B10ContentRecovery.required", "new required field: usageScope"],
  ["components.schemas.B10ContentRecovery.description", "description contract changed"],
  ["components.schemas.B10ContentRecovery.oneOf", "oneOf contract changed"],
  ["components.schemas.B10ContentRecovery.x-p1r-recovery-scope-policy", "unknown schema keyword or extension changed"],
  ["components.schemas.B10ContentRecovery.properties.mustNotRegrade.enum", "enum contract changed from unspecified to specified"],
  ["components.schemas.B10ContentRecovery.properties.mustNotRegrade.const", "const contract changed"],
  ["components.schemas.B10ContentRecovery.properties.recoveryReasonCode.enum", "new enum value added: RIGHTS_REMOVED"],
  ["components.schemas.B10ContentRecovery.properties.recoveryReasonCode.enum", "new enum value added: SECURITY_REMOVED"],
  ["components.schemas.B10ContentRecovery.properties.recoveryReasonCode.enum", "new enum value added: LEGAL_REMOVED"],
  ["components.schemas.B10AssessmentSession.properties.pin.$ref", "$ref contract changed"],
  ["components.schemas.B10Attempt.properties.pin.$ref", "$ref contract changed"],
  ["components.schemas.B10AssessmentReport.properties.pin.$ref", "$ref contract changed"],
  ["components.schemas.B10AssessmentReport.properties.replayable.enum", "enum contract changed from unspecified to specified"],
  ["components.schemas.B10AssessmentReport.properties.replayable.const", "const contract changed"],
  ["components.schemas.B10MasteryProjection.properties.pin.$ref", "$ref contract changed"],
]);

function parseArgs(argv) {
  const args = { kind: 'openapi', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') args.json = true;
    else if (value === '--help') args.help = true;
    else if (value === '--kind') args.kind = argv[++index];
    else if (value === '--baseline') args.baseline = argv[++index];
    else if (value === '--current') args.current = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function resolveInput(value, kind, flag) {
  if (!(kind in defaults)) throw new Error(`Unsupported contract kind: ${kind}`);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Compatibility ${flag} is required; pass both --baseline <old.json> and --current <new.json>.`);
  }
  return path.resolve(repoRoot, value);
}

function describeChange(kind, location, reason) {
  return { kind, location, reason };
}

function normalizedTypes(type) {
  if (type === undefined) return null;
  const values = Array.isArray(type) ? type : [type];
  return [...new Set(values.map((value) => String(value)))].sort();
}

function sameTypes(previous, current) {
  return previous.length === current.length && previous.every((value, index) => value === current[index]);
}

function compareSchema(previous, current, location, changes, kind) {
  if (!isRecord(previous)) return;
  if (!isRecord(current)) {
    changes.push(describeChange(kind, location, 'existing schema definition was removed or is no longer an object'));
    return;
  }

  const previousTypes = normalizedTypes(previous.type);
  const currentTypes = normalizedTypes(current.type);
  if ((previousTypes || currentTypes) && (!previousTypes || !currentTypes || !sameTypes(previousTypes, currentTypes))) {
    changes.push(describeChange(kind, location, `type changed from ${previousTypes?.join(',') ?? '<unspecified>'} to ${currentTypes?.join(',') ?? '<unspecified>'}`));
  }

  const previousEnum = Array.isArray(previous.enum) ? previous.enum : null;
  const currentEnum = Array.isArray(current.enum) ? current.enum : null;
  if (previousEnum && currentEnum) {
    const previousValues = new Map(previousEnum.map((value) => [stableGovernanceValue(value), value]));
    const currentValues = new Map(currentEnum.map((value) => [stableGovernanceValue(value), value]));
    for (const [stableValue, value] of previousValues) {
      if (!currentValues.has(stableValue)) {
        changes.push(describeChange(kind, `${location}.enum`, `existing enum value removed: ${String(value)}`));
      }
    }
    for (const [stableValue, value] of currentValues) {
      if (!previousValues.has(stableValue)) {
        changes.push(describeChange(kind, `${location}.enum`, `new enum value added: ${String(value)}`));
      }
    }
  } else if (previousEnum || currentEnum) {
    changes.push(describeChange(kind, `${location}.enum`, `enum contract changed from ${previousEnum ? 'specified' : 'unspecified'} to ${currentEnum ? 'specified' : 'unspecified'}`));
  }

  const previousRequired = new Set(Array.isArray(previous.required) ? previous.required : []);
  const currentRequired = new Set(Array.isArray(current.required) ? current.required : []);
  for (const field of currentRequired) {
    if (!previousRequired.has(field)) changes.push(describeChange(kind, `${location}.required`, `new required field: ${field}`));
  }
  for (const field of previousRequired) {
    if (!currentRequired.has(field)) changes.push(describeChange(kind, `${location}.required`, `existing required field removed: ${field}`));
  }

  if (isRecord(previous.additionalProperties) && isRecord(current.additionalProperties)) {
    compareSchema(previous.additionalProperties, current.additionalProperties, `${location}.additionalProperties`, changes, kind);
  } else if (stableGovernanceValue(previous.additionalProperties) !== stableGovernanceValue(current.additionalProperties)) {
    changes.push(describeChange(kind, `${location}.additionalProperties`, 'additionalProperties policy changed'));
  }

  const exactKeywords = [
    '$id', '$schema', '$ref', 'title', 'description', 'default', 'examples',
    'deprecated', 'readOnly', 'writeOnly', 'nullable', 'pattern', 'format',
    'const', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
    'minLength', 'maxLength', 'minItems', 'maxItems', 'minProperties',
    'maxProperties', 'uniqueItems',
  ];
  for (const keyword of exactKeywords) {
    if (stableGovernanceValue(previous[keyword]) !== stableGovernanceValue(current[keyword])) {
      changes.push(describeChange(kind, `${location}.${keyword}`, `${keyword} contract changed`));
    }
  }

  if (previous.items !== undefined || current.items !== undefined) {
    if (isRecord(previous.items) && isRecord(current.items)) {
      compareSchema(previous.items, current.items, `${location}.items`, changes, kind);
    } else if (stableGovernanceValue(previous.items) !== stableGovernanceValue(current.items)) {
      changes.push(describeChange(kind, `${location}.items`, 'items contract changed'));
    }
  }
  for (const keyword of ['oneOf', 'anyOf', 'allOf', 'not']) {
    if (stableGovernanceValue(previous[keyword]) !== stableGovernanceValue(current[keyword])) {
      changes.push(describeChange(kind, `${location}.${keyword}`, `${keyword} contract changed`));
    }
  }

  const knownKeywords = new Set([
    'type', 'enum', 'required', 'additionalProperties', 'properties', 'items',
    'oneOf', 'anyOf', 'allOf', 'not', ...exactKeywords,
  ]);
  const unknownKeywords = new Set([...Object.keys(previous), ...Object.keys(current)]
    .filter((keyword) => !knownKeywords.has(keyword)));
  for (const keyword of unknownKeywords) {
    if (stableGovernanceValue(previous[keyword]) !== stableGovernanceValue(current[keyword])) {
      changes.push(describeChange(kind, `${location}.${keyword}`, 'unknown schema keyword or extension changed'));
    }
  }

  const previousProperties = isRecord(previous.properties) ? previous.properties : {};
  const currentProperties = isRecord(current.properties) ? current.properties : {};
  for (const [field, previousProperty] of Object.entries(previousProperties)) {
    if (!(field in currentProperties)) {
      changes.push(describeChange(kind, `${location}.properties.${field}`, 'existing property removed'));
      continue;
    }
    compareSchema(previousProperty, currentProperties[field], `${location}.properties.${field}`, changes, kind);
  }
}

function resolveMaybe(document, value) {
  return isRecord(value) && typeof value.$ref === 'string' ? resolveJsonPointer(document, value.$ref) : value;
}

export function stableGovernanceValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableGovernanceValue).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableGovernanceValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function stableGovernanceSha256(value) {
  return createHash('sha256').update(stableGovernanceValue(value)).digest('hex');
}

function applyApprovedOpenApiProjection(target, approved, names) {
  if (!isRecord(target) || !isRecord(approved)) return false;
  for (const name of names) {
    if (!Object.hasOwn(approved, name)) return false;
    target[name] = structuredClone(approved[name]);
  }
  return true;
}

/**
 * Rebuild the one approved M1-008 OpenAPI projection from the frozen 6ce source.
 * The approved document contributes values only at an explicit B1/B9/B10/Gateway
 * allowlist. The resulting semantic hash is frozen separately, so changing an
 * allowlisted value or adding any unlisted projection still fails closed.
 */
export function buildM1008OpenApiExpectedProjection(previous, approved) {
  if (!isRecord(previous) || !isRecord(approved)) return undefined;
  const expected = structuredClone(previous);
  const projected = applyApprovedOpenApiProjection(expected.paths, approved.paths, M1008_OPENAPI_APPROVED_PATH_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected.components?.parameters, approved.components?.parameters, M1008_OPENAPI_APPROVED_PARAMETER_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected.components?.schemas, approved.components?.schemas, M1008_OPENAPI_APPROVED_SCHEMA_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected, approved, M1008_OPENAPI_APPROVED_ROOT_PROJECTIONS);
  return projected ? expected : undefined;
}

function m1008ChannelId(eventName) {
  return eventName.replaceAll('.', '_');
}

function m1008OperationId(action, eventName, consumerGroup) {
  const channelId = m1008ChannelId(eventName);
  if (action === 'send') return `publish_${channelId}`;
  return `subscribe_${channelId}_${consumerGroup.replace(/[.-]/g, '_')}`;
}

function buildM1008ContentGovernance(previousEvent, eventName, allowance) {
  const aggregateIdField = M1008_CONTENT_AGGREGATE_ID_FIELDS[eventName];
  const consumers = M1008_CONTENT_CONSUMERS[eventName];
  const channelId = m1008ChannelId(eventName);
  return {
    status: allowance.toStatus,
    runtimeStatus: allowance.runtimeStatus,
    scope: 'CROSS_SERVICE_INTEGRATION_FACT',
    producer: {
      service: 'content-service',
      dataOwner: 'content-service',
      outboxRequired: true,
      publishOperationId: m1008OperationId('send', eventName),
    },
    consumers: consumers.map((consumer) => ({
      service: consumer.service,
      consumerGroup: consumer.consumerGroup,
      subscriptionOperationId: m1008OperationId('receive', eventName, consumer.consumerGroup),
    })),
    transport: {
      protocol: 'kafka',
      topic: allowance.topic,
      partitionKey: 'aggregateId',
      aggregateIdSource: `payload.${aggregateIdField}`,
      delivery: 'at-least-once',
      bindingVersion: '0.5.0',
      channelId,
    },
    schema: {
      schemaVersion: 'content.event.v1',
      payloadRef: previousEvent?.payloadSchema?.$ref,
      compatibility: 'additive',
    },
    correlation: ['eventId', 'aggregateId', 'requestId', 'traceId', 'dedupeKey'],
    traceability: ['ARCH-EVT-001', 'INT-P1-017'],
  };
}

function buildM1008ContentChannel(eventName, previousEvent, allowance) {
  const channelId = m1008ChannelId(eventName);
  return {
    address: allowance.topic,
    bindings: {
      kafka: {
        topic: allowance.topic,
        bindingVersion: '0.5.0',
      },
    },
    messages: {
      event: {
        name: eventName,
        'x-event-name': eventName,
        payload: {
          $ref: previousEvent?.payloadSchema?.$ref,
        },
        bindings: {
          kafka: {
            key: {
              type: 'string',
              description: 'Canonical partition key from envelope.aggregateId.',
            },
            bindingVersion: '0.5.0',
          },
        },
      },
    },
  };
}

function buildM1008ContentPublishOperation(eventName, allowance) {
  const channelId = m1008ChannelId(eventName);
  return {
    action: 'send',
    channel: {
      $ref: `#/asyncapi/channels/${channelId}`,
    },
    messages: [
      {
        $ref: `#/asyncapi/channels/${channelId}/messages/event`,
      },
    ],
    bindings: {
      kafka: {
        bindingVersion: '0.5.0',
      },
    },
    'x-producer-service': 'content-service',
    'x-data-owner': 'content-service',
  };
}

function buildM1008ContentSubscribeOperation(eventName, consumer) {
  const channelId = m1008ChannelId(eventName);
  return {
    action: 'receive',
    channel: {
      $ref: `#/asyncapi/channels/${channelId}`,
    },
    messages: [
      {
        $ref: `#/asyncapi/channels/${channelId}/messages/event`,
      },
    ],
    bindings: {
      kafka: {
        groupId: {
          type: 'string',
          enum: [consumer.consumerGroup],
        },
        bindingVersion: '0.5.0',
      },
    },
    'x-consumer-service': consumer.service,
  };
}

function isValidM1008PromotionAllowance(allowance) {
  if (!isRecord(allowance) || allowance.id !== M1008_CONTENT_PROMOTION_ID) return false;
  if (allowance.sourceContractBaseline !== M1008_SOURCE_CONTRACT_BASELINE_REF
    || allowance.immutableGovernanceBaseline !== M1008_IMMUTABLE_GOVERNANCE_BASELINE_REF) return false;
  if (allowance.fromStatus !== 'HISTORICAL_CANDIDATE'
    || allowance.toStatus !== 'CANONICAL_D2'
    || allowance.runtimeStatus !== 'NOT_RUNTIME_VERIFIED'
    || allowance.topic !== 'platform.content.v1'
    || allowance.closureStatus !== 'D2_CONTRACT_CLOSED') return false;
  if (stableGovernanceValue(allowance.eventNames) !== stableGovernanceValue(M1008_CONTENT_EVENT_NAMES)
    || stableGovernanceValue(allowance.gapIds) !== stableGovernanceValue(M1008_CONTENT_GAP_IDS)
    || stableGovernanceValue(allowance.canonicalEnvelope) !== stableGovernanceValue(M1008_CANONICAL_ENVELOPE)) return false;
  return stableGovernanceValue(allowance.addedConsumerGroups)
    === stableGovernanceValue(['cg.admin-ops-from-content.v1', 'cg.audit-from-content.v1']);
}

/**
 * Build the sole event-catalog shape admitted by the M1-008 compatibility
 * promotion. Callers must validate the allowance source before using it.
 */
export function buildM1008PromotionExpectedCatalog(previous, allowance) {
  if (!isRecord(previous) || !isValidM1008PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  if (!isRecord(expected.asyncapi)
    || !isRecord(expected.asyncapi.channels)
    || !isRecord(expected.asyncapi.operations)
    || !isRecord(expected.payloadSchemas)) return undefined;

  const eventsByName = new Map((expected.events ?? []).map((event) => [event?.eventName, event]));
  const reviewedEvent = eventsByName.get('content.version.reviewed.v1');
  if (reviewedEvent?.payloadSchema?.$ref !== '#/payloadSchemas/B9ContentVersionReviewed'
    || !isRecord(expected.payloadSchemas.B9ContentVersionReviewed)) return undefined;
  // M1-008 explicitly tightens the reviewed fact so every decision is bound to
  // the immutable content bytes. This shape is constructed from policy, never
  // copied from the candidate catalog, and therefore remains fail closed.
  expected.payloadSchemas.B9ContentVersionReviewed = structuredClone(M1008_REVIEWED_EVENT_PAYLOAD_SCHEMA);
  reviewedEvent.compatibility = structuredClone(M1008_REVIEWED_EVENT_COMPATIBILITY);
  for (const eventName of allowance.eventNames ?? []) {
    const event = eventsByName.get(eventName);
    const consumers = M1008_CONTENT_CONSUMERS[eventName];
    if (!isRecord(event) || !consumers) return undefined;
    event.status = allowance.toStatus;
    event['x-envelope-required'] = [...allowance.canonicalEnvelope];
    event['x-p1r-governance'] = buildM1008ContentGovernance(event, eventName, allowance);

    const channelId = m1008ChannelId(eventName);
    expected.asyncapi.channels[channelId] = buildM1008ContentChannel(eventName, event, allowance);
    expected.asyncapi.operations[m1008OperationId('send', eventName)] = buildM1008ContentPublishOperation(eventName, allowance);
    for (const consumer of consumers) {
      expected.asyncapi.operations[m1008OperationId('receive', eventName, consumer.consumerGroup)] = buildM1008ContentSubscribeOperation(eventName, consumer);
    }
  }

  const closures = expected['x-p1r-event-governance']?.plannedClosures;
  if (!Array.isArray(closures)) return undefined;
  for (const gapId of allowance.gapIds ?? []) {
    const closure = closures.find((candidate) => candidate?.gapId === gapId);
    if (!isRecord(closure)) return undefined;
    closure.status = allowance.closureStatus;
  }
  return expected;
}

/**
 * Build the sole B26 runtime shape admitted by the M1-008 promotion. Existing
 * topic settings/groups/routes are copied from the immutable baseline; only
 * the two named content consumer groups, their READ ACLs and five content
 * routes are appended.
 */
export function buildM1008PromotionExpectedB26(previous, allowance) {
  if (!isRecord(previous) || !isValidM1008PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const topics = Array.isArray(expected.topics) ? expected.topics : undefined;
  const contentTopic = topics?.find((topic) => topic?.name === allowance.topic);
  if (!isRecord(contentTopic)
    || !Array.isArray(contentTopic.consumerGroups)
    || !Array.isArray(contentTopic.acl)
    || !Array.isArray(expected.eventRouting)) return undefined;
  const addedGroups = [
    {
      name: 'cg.admin-ops-from-content.v1',
      service: 'admin-ops-service',
      principal: 'cg.admin-ops-from-content.v1',
      replayEnabled: true,
    },
    {
      name: 'cg.audit-from-content.v1',
      service: 'audit-service',
      principal: 'cg.audit-from-content.v1',
      replayEnabled: true,
    },
  ];
  const currentGroupNames = new Set((contentTopic.consumerGroups ?? []).map((group) => group?.name));
  for (const group of addedGroups) {
    if (!currentGroupNames.has(group.name)) contentTopic.consumerGroups.push(group);
  }
  const acl = [
    {
      principal: 'cg.admin-ops-from-content.v1',
      operation: 'READ',
      effect: 'ALLOW',
    },
    {
      principal: 'cg.audit-from-content.v1',
      operation: 'READ',
      effect: 'ALLOW',
    },
  ];
  const currentAcl = new Set((contentTopic.acl ?? []).map((entry) => stableGovernanceValue(entry)));
  for (const entry of acl) {
    if (!currentAcl.has(stableGovernanceValue(entry))) contentTopic.acl.push(entry);
  }
  const existingRoutes = new Set(expected.eventRouting.map((route) => route?.eventName));
  for (const eventName of allowance.eventNames ?? []) {
    if (!existingRoutes.has(eventName)) {
      expected.eventRouting.push({
        eventName,
        topic: allowance.topic,
        partitionKey: 'aggregateId',
        consumerGroups: M1008_CONTENT_CONSUMERS[eventName].map((consumer) => consumer.consumerGroup),
      });
    }
  }
  return expected;
}

function compareM1008Promotion(previous, current, allowance) {
  const expected = buildM1008PromotionExpectedCatalog(previous, allowance);
  if (expected === undefined) {
    return [describeChange(
      'events',
      'm1-008.compatibilityPromotion',
      'M1-008 promotion allowance cannot be applied to this governance baseline',
    )];
  }
  const changes = compareEvents(expected, current);
  if (stableGovernanceValue(expected) !== stableGovernanceValue(current)) {
    changes.push(describeChange(
      'events',
      'm1-008.compatibilityPromotion',
      'current event catalog differs from the explicit M1-008 promotion projection',
    ));
  }
  return changes;
}

function compareM1008OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1008PromotionAllowance(allowance)) {
    return [describeChange(
      'openapi',
      'm1-008.openapiPromotion',
      'M1-008 promotion allowance cannot be applied without the frozen policy allowance',
    )];
  }

  const changes = [];
  if (stableGovernanceSha256(previous) !== M1008_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange(
      'openapi',
      'm1-008.openapiPromotion.source',
      'M1-008 OpenAPI promotion source is not the frozen 6ce98a9 source projection',
    ));
  }

  const expectedDescriptors = M1008_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS
    .map(([location, reason]) => describeChange('openapi', location, reason))
    .sort(function (left, right) { return stableGovernanceValue(left).localeCompare(stableGovernanceValue(right)); });
  const actualDescriptors = compareOpenApi(previous, current)
    .sort(function (left, right) { return stableGovernanceValue(left).localeCompare(stableGovernanceValue(right)); });
  if (stableGovernanceValue(actualDescriptors) !== stableGovernanceValue(expectedDescriptors)) {
    changes.push(describeChange(
      'openapi',
      'm1-008.openapiPromotion.change-descriptors',
      'current OpenAPI changes do not exactly match the frozen M1-008 descriptor set',
    ));
  }
  const expectedProjection = buildM1008OpenApiExpectedProjection(previous, current);
  if (expectedProjection === undefined) {
    changes.push(describeChange(
      'openapi',
      'm1-008.openapiPromotion.projection',
      'the approved B1/B9/B10/Gateway projection cannot be constructed from the frozen source',
    ));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1008_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange(
        'openapi',
        'm1-008.openapiPromotion.expected-projection',
        'the allowlisted M1-008 projection does not match its frozen semantic digest',
      ));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange(
        'openapi',
        'm1-008.openapiPromotion.projection',
        'current OpenAPI is not the unique frozen-source B1/B9/B10/Gateway projection',
      ));
    }
  }
  return changes;
}

function duplicateEventNames(events) {
  const seen = new Set();
  const duplicates = new Set();
  for (const event of events ?? []) {
    if (seen.has(event?.eventName)) duplicates.add(event?.eventName);
    seen.add(event?.eventName);
  }
  return [...duplicates].sort();
}

export function hasEventGovernance(catalog) {
  if (!isRecord(catalog)) return false;
  return catalog['x-p1r-event-governance'] !== undefined
    || (Array.isArray(catalog.events)
      && catalog.events.some((event) => isRecord(event)
        && (event.status !== undefined || event['x-p1r-governance'] !== undefined)));
}

function compareImmutableEventGovernance(governanceBaseline, current, changes, allowance) {
  if (!hasEventGovernance(governanceBaseline)) {
    changes.push(describeChange(
      'events',
      'x-p1r-event-governance',
      'immutable governance baseline is missing platform or event governance',
    ));
    return;
  }

  if (allowance?.id === M1008_CONTENT_PROMOTION_ID) {
    changes.push(...compareM1008Promotion(governanceBaseline, current, allowance));
    return;
  }

  if (stableGovernanceValue(governanceBaseline['x-p1r-event-governance'])
    !== stableGovernanceValue(current['x-p1r-event-governance'])) {
    changes.push(describeChange(
      'events',
      'x-p1r-event-governance',
      'immutable governance baseline platform policy changed',
    ));
  }

  const baselineEvents = new Map((governanceBaseline.events ?? []).map((event) => [event.eventName, event]));
  const currentEvents = new Map((current.events ?? []).map((event) => [event.eventName, event]));
  for (const [eventName, baselineEvent] of baselineEvents) {
    const currentEvent = currentEvents.get(eventName);
    if (!currentEvent) {
      changes.push(describeChange('events', eventName, 'immutable governance baseline event was removed'));
      continue;
    }
    if (stableGovernanceValue(baselineEvent.status) !== stableGovernanceValue(currentEvent.status)) {
      changes.push(describeChange('events', `${eventName}.status`, 'immutable governance baseline status changed'));
    }

    const baselineGovernance = baselineEvent['x-p1r-governance'];
    const currentGovernance = currentEvent['x-p1r-governance'];
    if (stableGovernanceValue(baselineGovernance) === stableGovernanceValue(currentGovernance)) continue;

    const baselineProducer = isRecord(baselineGovernance?.producer) ? baselineGovernance.producer : {};
    const currentProducer = isRecord(currentGovernance?.producer) ? currentGovernance.producer : {};
    for (const field of ['service', 'dataOwner']) {
      if (baselineProducer[field] !== currentProducer[field]) {
        changes.push(describeChange(
          'events',
          `${eventName}.x-p1r-governance.producer.${field}`,
          `immutable governance baseline producer ${field} changed`,
        ));
      }
    }
    const baselineTransport = isRecord(baselineGovernance?.transport) ? baselineGovernance.transport : {};
    const currentTransport = isRecord(currentGovernance?.transport) ? currentGovernance.transport : {};
    for (const field of ['topic', 'partitionKey']) {
      if (baselineTransport[field] !== currentTransport[field]) {
        changes.push(describeChange(
          'events',
          `${eventName}.x-p1r-governance.transport.${field}`,
          `immutable governance baseline transport ${field} changed`,
        ));
      }
    }
    if (stableGovernanceValue(baselineGovernance?.consumers) !== stableGovernanceValue(currentGovernance?.consumers)) {
      changes.push(describeChange(
        'events',
        `${eventName}.x-p1r-governance.consumers`,
        'immutable governance baseline consumer groups changed',
      ));
    }
    changes.push(describeChange(
      'events',
      `${eventName}.x-p1r-governance`,
      'immutable governance baseline producer, owner, consumer, transport, schema or correlation governance changed',
    ));
  }

  if (stableGovernanceValue(governanceBaseline.asyncapi) !== stableGovernanceValue(current.asyncapi)) {
    changes.push(describeChange('events', 'asyncapi', 'immutable governance baseline canonical AsyncAPI projection changed'));
  }
}

export function compareB26WorkflowGovernance(governanceBaseline, current, { allowance } = {}) {
  const changes = [];
  if (allowance?.id === M1008_CONTENT_PROMOTION_ID) {
    const expected = buildM1008PromotionExpectedB26(governanceBaseline, allowance);
    if (expected === undefined) {
      return [describeChange(
        'events',
        'b26.m1-008.compatibilityPromotion',
        'M1-008 B26 promotion allowance cannot be applied to this governance baseline',
      )];
    }
    if (stableGovernanceValue(expected) !== stableGovernanceValue(current)) {
      const strictChanges = compareB26WorkflowGovernance(expected, current);
      return [...strictChanges, describeChange(
        'events',
        'b26.m1-008.compatibilityPromotion',
        'current B26 runtime policy differs from the explicit M1-008 content-topic promotion',
      )];
    }
    return changes;
  }
  if (stableGovernanceValue(governanceBaseline?.topics) !== stableGovernanceValue(current?.topics)) {
    changes.push(describeChange(
      'events',
      'b26.topics',
      'immutable B26 topic, owner, producer principal, consumer group or ACL policy changed',
    ));
  }
  const topicLocation = 'b26.topics.platform.workflow.v1';
  const baselineTopics = Array.isArray(governanceBaseline?.topics)
    ? governanceBaseline.topics.filter((topic) => topic?.name === 'platform.workflow.v1')
    : [];
  const currentTopics = Array.isArray(current?.topics)
    ? current.topics.filter((topic) => topic?.name === 'platform.workflow.v1')
    : [];
  if (baselineTopics.length !== 1 || !isRecord(baselineTopics[0])) {
    changes.push(describeChange('events', topicLocation, 'immutable governance baseline is missing the workflow topic'));
    return changes;
  }
  if (currentTopics.length !== 1 || !isRecord(currentTopics[0])) {
    changes.push(describeChange('events', topicLocation, 'immutable B26 workflow topic was removed, duplicated or is not an object'));
  } else {
    const baselineTopic = baselineTopics[0];
    const currentTopic = currentTopics[0];
    for (const field of ['ownerService', 'producerPrincipal', 'partitionKey', 'consumerGroups', 'acl']) {
      if (stableGovernanceValue(baselineTopic[field]) !== stableGovernanceValue(currentTopic[field])) {
        changes.push(describeChange(
          'events',
          `${topicLocation}.${field}`,
          `immutable B26 workflow topic ${field} changed`,
        ));
      }
    }
    if (stableGovernanceValue(baselineTopic) !== stableGovernanceValue(currentTopic)) {
      changes.push(describeChange(
        'events',
        topicLocation,
        'immutable B26 workflow topic static policy changed',
      ));
    }
  }

  const baselineRouting = Array.isArray(governanceBaseline?.eventRouting)
    ? governanceBaseline.eventRouting
    : undefined;
  const currentRouting = Array.isArray(current?.eventRouting) ? current.eventRouting : undefined;
  if (!Array.isArray(baselineRouting)) {
    changes.push(describeChange('events', 'b26.eventRouting', 'immutable governance baseline is missing B26 event routing'));
  } else if (!Array.isArray(currentRouting)
    || stableGovernanceValue(baselineRouting) !== stableGovernanceValue(currentRouting)) {
    changes.push(describeChange(
      'events',
      'b26.eventRouting',
      'immutable B26 event routing topic, partition key or consumer groups changed',
    ));
  }
  return changes;
}

export function compareOpenApi(previous, current) {
  const changes = [];
  const previousSecuritySchemes = previous.components?.securitySchemes ?? {};
  const currentSecuritySchemes = current.components?.securitySchemes ?? {};
  for (const [name, previousScheme] of Object.entries(previousSecuritySchemes)) {
    if (!(name in currentSecuritySchemes)) {
      changes.push(describeChange('openapi', `components.securitySchemes.${name}`, 'existing security scheme removed'));
      continue;
    }
    const currentScheme = currentSecuritySchemes[name];
    for (const field of ['type', 'scheme', 'bearerFormat', 'openIdConnectUrl']) {
      if (previousScheme?.[field] !== undefined && currentScheme?.[field] !== previousScheme[field]) {
        changes.push(describeChange('openapi', `components.securitySchemes.${name}.${field}`, `security scheme ${field} changed`));
      }
    }
  }
  const previousPaths = isRecord(previous.paths) ? previous.paths : {};
  const currentPaths = isRecord(current.paths) ? current.paths : {};
  for (const [route, previousPath] of Object.entries(previousPaths)) {
    if (!(route in currentPaths)) {
      changes.push(describeChange('openapi', route, 'existing route removed'));
      continue;
    }
    for (const [method, previousOperation] of Object.entries(previousPath)) {
      if (!isHttpMethod(method)) continue;
      const currentOperation = currentPaths[route]?.[method];
      if (!currentOperation) {
        changes.push(describeChange('openapi', `${method.toUpperCase()} ${route}`, 'existing operation removed'));
        continue;
      }
      const previousSecurity = Array.isArray(previousOperation.security) ? previousOperation.security : null;
      const currentSecurity = Array.isArray(currentOperation.security) ? currentOperation.security : null;
      if (previousSecurity && previousSecurity.length > 0 && (!currentSecurity || currentSecurity.length === 0)) {
        changes.push(describeChange('openapi', `${method.toUpperCase()} ${route}.security`, 'authenticated operation became public'));
      } else if (previousSecurity && currentSecurity) {
        const previousSchemes = new Set(previousSecurity.flatMap((requirement) => Object.keys(requirement ?? {})));
        const currentSchemes = new Set(currentSecurity.flatMap((requirement) => Object.keys(requirement ?? {})));
        for (const scheme of previousSchemes) {
          if (!currentSchemes.has(scheme)) changes.push(describeChange('openapi', `${method.toUpperCase()} ${route}.security`, `existing security scheme requirement removed: ${scheme}`));
        }
      }
      for (const field of ['x-migration', 'x-idempotency']) {
        if (previousOperation[field] !== undefined
          && stableGovernanceValue(previousOperation[field]) !== stableGovernanceValue(currentOperation[field])) {
          changes.push(describeChange(
            'openapi',
            `${method.toUpperCase()} ${route}.${field}`,
            `operation ${field} contract changed`,
          ));
        }
      }
      const previousRequest = resolveMaybe(previous, previousOperation.requestBody?.content?.['application/json']?.schema);
      const currentRequest = resolveMaybe(current, currentOperation.requestBody?.content?.['application/json']?.schema);
      if (previousRequest && currentRequest) compareSchema(previousRequest, currentRequest, `${method.toUpperCase()} ${route}.request`, changes, 'openapi');
      const previousResponses = isRecord(previousOperation.responses) ? previousOperation.responses : {};
      const currentResponses = isRecord(currentOperation.responses) ? currentOperation.responses : {};
      for (const status of Object.keys(previousResponses)) {
        if (!(status in currentResponses)) changes.push(describeChange('openapi', `${method.toUpperCase()} ${route}.responses.${status}`, 'existing response removed'));
      }
    }
  }

  const previousSchemas = previous.components?.schemas ?? {};
  const currentSchemas = current.components?.schemas ?? {};
  for (const [name, previousSchema] of Object.entries(previousSchemas)) {
    if (!(name in currentSchemas)) {
      changes.push(describeChange('openapi', `components.schemas.${name}`, 'existing schema removed'));
      continue;
    }
    compareSchema(previousSchema, currentSchemas[name], `components.schemas.${name}`, changes, 'openapi');
  }
  return changes;
}

function compareEvents(previous, current, { governanceBaseline, allowance } = {}) {
  if (allowance?.id === M1008_CONTENT_PROMOTION_ID) {
    return compareM1008Promotion(previous, current, allowance);
  }
  const changes = [];
  for (const error of validateEventPayloadSchemas(current.payloadSchemas)) {
    changes.push(describeChange('events', 'payloadSchemas', error));
  }
  const previousHasGovernance = hasEventGovernance(previous);
  const currentHasGovernance = hasEventGovernance(current);
  if (!previousHasGovernance && governanceBaseline !== undefined) {
    compareImmutableEventGovernance(governanceBaseline, current, changes, allowance);
  } else if (!previousHasGovernance && currentHasGovernance) {
    changes.push(describeChange(
      'events',
      'x-p1r-event-governance',
      'first governance introduction requires an explicit immutable governance baseline',
    ));
  }
  for (const field of [
    'catalogVersion',
    'schema',
    'description',
    'x-v2-event-platform',
    'envelope',
    'compatibilityPolicy',
    'forbiddenPayloadFieldPatterns',
  ]) {
    if (previous[field] !== undefined
      && stableGovernanceValue(previous[field]) !== stableGovernanceValue(current[field])) {
      changes.push(describeChange('events', field, `established event catalog ${field} changed`));
    }
  }
  for (const eventName of duplicateEventNames(previous.events)) {
    changes.push(describeChange('events', `${eventName}.eventName`, 'baseline contains a duplicate event name'));
  }
  for (const eventName of duplicateEventNames(current.events)) {
    changes.push(describeChange('events', `${eventName}.eventName`, 'current catalog contains a duplicate event name'));
  }
  const previousEvents = new Map((previous.events ?? []).map((event) => [event.eventName, event]));
  const currentEvents = new Map((current.events ?? []).map((event) => [event.eventName, event]));
  for (const [eventName, previousEvent] of previousEvents) {
    const currentEvent = currentEvents.get(eventName);
    if (!currentEvent) {
      changes.push(describeChange('events', eventName, 'existing event removed'));
      continue;
    }
    if (Number(previousEvent.version) !== Number(currentEvent.version)) {
      changes.push(describeChange('events', eventName, 'event version changed without a new event name'));
    }
    for (const field of ['domain', 'schema', 'aggregateType', 'aggregateIdField']) {
      if (previousEvent[field] !== undefined && currentEvent[field] !== previousEvent[field]) {
        changes.push(describeChange('events', `${eventName}.${field}`, `existing event ${field} changed`));
      }
    }
    if (previousEvent.payloadSchema?.$ref !== undefined && currentEvent.payloadSchema?.$ref !== previousEvent.payloadSchema.$ref) {
      changes.push(describeChange('events', `${eventName}.payloadSchema.$ref`, 'existing payload schema identity changed'));
    }
    if (previousEvent.compatibility !== undefined
      && stableGovernanceValue(previousEvent.compatibility) !== stableGovernanceValue(currentEvent.compatibility)) {
      changes.push(describeChange('events', `${eventName}.compatibility`, 'existing compatibility policy changed'));
    }
    const previousEnvelopeRequired = new Set(previousEvent['x-envelope-required'] ?? []);
    const currentEnvelopeRequired = new Set(currentEvent['x-envelope-required'] ?? []);
    for (const field of previousEnvelopeRequired) {
      if (!currentEnvelopeRequired.has(field)) changes.push(describeChange('events', `${eventName}.x-envelope-required`, `existing required envelope field removed: ${field}`));
    }
    for (const field of currentEnvelopeRequired) {
      if (!previousEnvelopeRequired.has(field)) changes.push(describeChange('events', `${eventName}.x-envelope-required`, `new required envelope field: ${field}`));
    }
    const previousPayload = resolveMaybe(previous, previousEvent.payloadSchema);
    const currentPayload = resolveMaybe(current, currentEvent.payloadSchema);
    compareSchema(previousPayload, currentPayload, `${eventName}.payload`, changes, 'events');

    if (previousEvent.status !== undefined && currentEvent.status !== previousEvent.status) {
      changes.push(describeChange('events', `${eventName}.status`, `event governance status changed from ${String(previousEvent.status)} to ${String(currentEvent.status)}`));
    }
    const previousGovernance = previousEvent['x-p1r-governance'];
    const currentGovernance = currentEvent['x-p1r-governance'];
    if (previousGovernance !== undefined && currentGovernance === undefined) {
      changes.push(describeChange('events', `${eventName}.x-p1r-governance`, 'existing event governance was removed'));
    } else if (previousGovernance !== undefined && currentGovernance !== undefined
      && stableGovernanceValue(previousGovernance) !== stableGovernanceValue(currentGovernance)) {
      changes.push(describeChange('events', `${eventName}.x-p1r-governance`, 'producer, owner, consumer, transport, schema or correlation governance changed'));
    }
  }

  const previousPlatformGovernance = previous['x-p1r-event-governance'];
  const currentPlatformGovernance = current['x-p1r-event-governance'];
  if (previousPlatformGovernance !== undefined && currentPlatformGovernance === undefined) {
    changes.push(describeChange('events', 'x-p1r-event-governance', 'platform event governance was removed'));
  } else if (previousPlatformGovernance !== undefined && currentPlatformGovernance !== undefined
    && stableGovernanceValue(previousPlatformGovernance) !== stableGovernanceValue(currentPlatformGovernance)) {
    changes.push(describeChange('events', 'x-p1r-event-governance', 'established platform event governance changed'));
  }
  if (previousPlatformGovernance !== undefined
    && stableGovernanceValue(previous.asyncapi) !== stableGovernanceValue(current.asyncapi)) {
    changes.push(describeChange('events', 'asyncapi', 'established canonical AsyncAPI projection changed'));
  }
  return changes;
}

function compareSchemaRegistry(previous, current) {
  const changes = [];
  const previousSchemas = previous.schemas ?? {};
  const currentSchemas = current.schemas ?? {};
  for (const [schemaId, previousSchema] of Object.entries(previousSchemas)) {
    if (!(schemaId in currentSchemas)) {
      changes.push(describeChange('schema', schemaId, 'existing JSON Schema removed'));
      continue;
    }
    compareSchema(previousSchema, currentSchemas[schemaId], schemaId, changes, 'schema');
  }
  return changes;
}

export function compareContracts(kind, previous, current, { governanceBaseline, allowance } = {}) {
  if (kind === 'openapi') {
    if (allowance?.id === M1008_CONTENT_PROMOTION_ID) {
      return compareM1008OpenApiPromotion(previous, current, allowance);
    }
    return compareOpenApi(previous, current);
  }
  if (kind === 'events') return compareEvents(previous, current, { governanceBaseline, allowance });
  if (kind === 'schema') return compareSchemaRegistry(previous, current);
  throw new Error(`Unsupported contract kind: ${kind}`);
}

export function runCompatibilityDiff({ kind = 'openapi', baseline, current } = {}) {
  const baselinePath = resolveInput(baseline, kind, '--baseline');
  const currentPath = resolveInput(current, kind, '--current');
  if (baselinePath === currentPath) {
    throw new Error('Compatibility --baseline and --current must resolve to different files.');
  }
  const previous = readJson(baselinePath);
  const next = readJson(currentPath);
  const breakingChanges = compareContracts(kind, previous, next);
  return { kind, baseline: baselinePath, current: currentPath, breakingChanges, compatible: breakingChanges.length === 0 };
}

function printHelp() {
  console.log('Usage: node scripts/contracts/compatibility-diff.mjs --kind openapi|events|schema --baseline <old.json> --current <new.json> [--json]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const result = runCompatibilityDiff(args);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else console.log(`Contract compatibility ${result.compatible ? 'passed' : 'failed'}: ${result.kind}, ${result.breakingChanges.length} breaking change(s).`);
    if (!result.compatible) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
