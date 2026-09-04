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

export const M1009_MEDIA_PROMOTION_ID = 'M1-009_MEDIA_CONTRACT_PROMOTION';
export const M1009_SOURCE_CONTRACT_BASELINE_REF = 'ca282cd00dabeeb3fafbf6b4570054bd5b9f8549';
export const M1009_OPENAPI_SOURCE_SEMANTIC_SHA256 = 'e6a0cb64034fd8d921ef90b86e1eac20908b56e8ddee5d65ac7257dbb2320e1c';
export const M1009_OPENAPI_EXPECTED_SEMANTIC_SHA256 = '4c9e3b197f4ec93977af0afbd98141b30eae62d2401b5a6ce28ab7537ada90d2';
const M1009_OPENAPI_APPROVED_PATH_PROJECTIONS = Object.freeze([
  '/api/v1/content/media/upload-intents',
  '/api/v1/content/media/{mediaAssetId}/complete',
  '/api/v1/content/media/{mediaAssetId}/signed-access',
  '/api/v1/media/assets/{assetId}',
  '/api/v1/media/assets/{assetId}/content',
  '/api/v1/media/assets/{assetId}/manifest',
  '/api/v1/media/assets/{assetId}/signed-access',
  '/api/v1/media/assets/{assetId}/signed-url',
  '/api/v1/media/processing-tasks/{taskId}',
  '/api/v1/media/processing-tasks/{taskId}/retry',
  '/api/v1/media/upload-intents',
  '/api/v1/media/upload-intents/{uploadIntentId}/complete',
  '/api/v1/multimodal/recordings',
  '/api/v1/speaking/recordings',
  '/api/v1/speaking/recordings/upload-intents',
  '/api/v1/speaking/recordings/{recordingId}',
  '/api/v1/speaking/recordings/{recordingId}/complete',
  '/api/v1/speaking/recordings/{recordingId}/self-rating',
  '/api/v1/speaking/shadowing/completions',
  '/api/v1/speaking/shadowing/sessions',
  '/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/complete',
  '/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress',
]);
const M1009_OPENAPI_APPROVED_SCHEMA_PROJECTIONS = Object.freeze([
  'B8Consent',
  'B8ConsentState',
  'B8ConsentUpdateRequest',
  'MediaAccessBinding',
  'MediaAsset',
  'MediaExpectedObject',
  'MediaFallbackAlternative',
  'MediaIntegrity',
  'MediaManifest',
  'MediaPlaybackCapability',
  'MediaProcessingTask',
  'MediaProcessingTaskRetryRequest',
  'MediaPublishEligibility',
  'MediaRendition',
  'MediaSignedAccessGrant',
  'MediaSignedAccessRequest',
  'MediaSubtitleTrack',
  'MediaUploadBinding',
  'MediaUploadGrant',
  'MediaUploadIntent',
  'MediaUploadIntentCompleteRequest',
  'MediaUploadIntentCompletion',
  'MediaUploadIntentRequest',
  'SpeakingRecording',
  'SpeakingRecordingCompleteRequest',
  'SpeakingRecordingDeleteReceipt',
  'SpeakingRecordingUploadIntent',
  'SpeakingRecordingUploadIntentRequest',
  'SpeakingShadowingCompletionReceipt',
  'SpeakingShadowingCompletionRequest',
  'SpeakingShadowingProgressRequest',
  'SpeakingShadowingSession',
  'SpeakingShadowingSessionCreateRequest',
]);
const M1009_OPENAPI_APPROVED_RESPONSE_PROJECTIONS = Object.freeze([
  'MediaGone',
]);
const M1009_OPENAPI_APPROVED_ROOT_PROJECTIONS = Object.freeze([
  'x-b8-iam-policy-governance',
  'x-p1r-gateway-boundary',
  'x-p1r-media-contract',
]);
const M1009_OPENAPI_APPROVED_TAGS = Object.freeze([
  'P1R-Media',
  'P1R-Recording',
  'P1R-Shadowing',
]);
export const M1009_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ["DELETE /api/v1/speaking/recordings/{recordingId}.x-idempotency", "operation x-idempotency contract changed"],
  ["DELETE /api/v1/speaking/recordings/{recordingId}.responses.200", "existing response removed"],
  ["POST /api/v1/speaking/shadowing/sessions.x-idempotency", "operation x-idempotency contract changed"],
  ["POST /api/v1/speaking/shadowing/sessions.request.required", "new required field: sourceContentVersionId"],
  ["POST /api/v1/speaking/shadowing/sessions.request.required", "existing required field removed: targetGapMs"],
  ["POST /api/v1/speaking/shadowing/sessions.request.required", "existing required field removed: contentVersionId"],
  ["POST /api/v1/speaking/shadowing/sessions.request.required", "existing required field removed: clientEventId"],
  ["POST /api/v1/speaking/shadowing/sessions.request.additionalProperties", "additionalProperties policy changed"],
  ["POST /api/v1/speaking/shadowing/sessions.request.x-server-derived", "unknown schema keyword or extension changed"],
  ["POST /api/v1/speaking/shadowing/sessions.request.properties.sourceSegmentId.minLength", "minLength contract changed"],
  ["POST /api/v1/speaking/shadowing/sessions.request.properties.sourceSegmentId.maxLength", "maxLength contract changed"],
  ["POST /api/v1/speaking/shadowing/sessions.request.properties.targetGapMs", "existing property removed"],
  ["POST /api/v1/speaking/shadowing/sessions.request.properties.contentVersionId", "existing property removed"],
  ["POST /api/v1/speaking/shadowing/sessions.request.properties.clientEventId", "existing property removed"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.x-idempotency", "operation x-idempotency contract changed"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.required", "new required field: progressMs"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.required", "new required field: expectedSessionVersion"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.required", "existing required field removed: positionMs"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.required", "existing required field removed: attemptNo"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.required", "existing required field removed: clientEventId"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.additionalProperties", "additionalProperties policy changed"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.x-client-result-authority", "unknown schema keyword or extension changed"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.properties.positionMs", "existing property removed"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.properties.attemptNo", "existing property removed"],
  ["POST /api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress.request.properties.clientEventId", "existing property removed"],
  ["PUT /api/v1/iam/consents.request.properties.type.enum", "new enum value added: VOICE_RECORDING"],
  ["components.schemas.B8Consent.required", "new required field: purpose"],
  ["components.schemas.B8Consent.required", "new required field: required"],
  ["components.schemas.B8Consent.required", "new required field: document"],
  ["components.schemas.B8Consent.required", "new required field: state"],
  ["components.schemas.B8Consent.required", "new required field: effectiveAt"],
  ["components.schemas.B8Consent.required", "new required field: restrictionEffect"],
  ["components.schemas.B8Consent.required", "new required field: revalidation"],
  ["components.schemas.B8Consent.required", "new required field: withdrawalEffect"],
  ["components.schemas.B8Consent.required", "new required field: provenance"],
  ["components.schemas.B8Consent.required", "new required field: policyRef"],
  ["components.schemas.B8Consent.required", "new required field: policyVersion"],
  ["components.schemas.B8Consent.required", "new required field: decisionRef"],
  ["components.schemas.B8Consent.additionalProperties", "additionalProperties policy changed"],
  ["components.schemas.B8Consent.x-server-authoritative-fields", "unknown schema keyword or extension changed"],
  ["components.schemas.B8Consent.properties.type.enum", "new enum value added: VOICE_RECORDING"],
  ["components.schemas.B8Consent.properties.purpose.enum", "new enum value added: ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY"],
  ["components.schemas.B8ConsentState.properties.requiredPurposes.items.enum", "enum contract changed from unspecified to specified"],
  ["components.schemas.B8ConsentState.properties.unsatisfiedPurposes.items.enum", "enum contract changed from unspecified to specified"],
  ["components.schemas.B8ConsentUpdateRequest.properties.type.enum", "new enum value added: VOICE_RECORDING"],
]);

export const M1010_ASSESSMENT_PROMOTION_ID = 'M1-010_ASSESSMENT_CONTRACT_PROMOTION';
export const M1010_SOURCE_CONTRACT_BASELINE_REF = '760621e45b9adc95a6aa40fb1678a8d3ebc87797';
export const M1010_OPENAPI_SOURCE_SEMANTIC_SHA256 = '4c9e3b197f4ec93977af0afbd98141b30eae62d2401b5a6ce28ab7537ada90d2';
export const M1010_OPENAPI_EXPECTED_SEMANTIC_SHA256 = '55dc56fffdd3f94898e62149b48ac400af5eada2a969c396205939ba41f115ed';
export const M1010_EVENT_SOURCE_SEMANTIC_SHA256 = 'c12e249d48f85e439634e10e71e94db9be9b96cc1e2bb72e465383efb497840e';
export const M1010_EVENT_EXPECTED_SEMANTIC_SHA256 = 'bba617d505acd04ac14a2c3c5e261c02e6ab8a075c5c551fe05eabe849024470';
export const M1010_ASSESSMENT_EVENT_NAMES = Object.freeze([
  'assessment.attempt.submitted.v1',
  'assessment.attempt.assessed.v1',
]);
const M1010_OPENAPI_APPROVED_PATH_PROJECTIONS = Object.freeze([
  '/api/v1/assessment/daily-stream',
  '/api/v1/assessment/sessions',
  '/api/v1/assessment/sessions/{sessionId}',
  '/api/v1/assessment/sessions/{sessionId}/answers',
  '/api/v1/assessment/sessions/{sessionId}/checkpoint',
  '/api/v1/assessment/sessions/{sessionId}/complete',
  '/api/v1/exam/sessions',
  '/api/v1/exam/sessions/{sessionId}/heartbeat',
  '/api/v1/exam/sessions/{sessionId}/anti-cheat-events',
  '/api/v1/exam/sessions/{sessionId}/answer-sheet/marks',
  '/api/v1/exam/sessions/{sessionId}/checkpoint',
  '/api/v1/exam/sessions/{sessionId}/answers',
  '/api/v1/exam/sessions/{sessionId}/submit',
  '/api/v1/assessment/sessions/{sessionId}/attempts',
  '/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint',
  '/api/v1/assessment/reports/{reportId}',
]);
const M1010_OPENAPI_APPROVED_SCHEMA_PROJECTIONS = Object.freeze([
  'B10RuleContract',
  'B10AssessmentContentSnapshot',
  'B10AssessmentSession',
  'B10AttemptSubmission',
  'B10SubmitAttemptRequest',
  'B10Attempt',
  'B10CheckpointRequest',
  'B10Checkpoint',
  'B10AssessmentReport',
  'B10ActiveSessionAttemptPin',
  'B10RuleVersion',
  'B10SessionStatus',
  'B10AttemptStatus',
  'B10ReportStatus',
  'B10AssessmentItemRulePin',
  'B10ReasonTrace',
  'B10ObjectiveOutcome',
  'B10SelfRatingOutcome',
  'B10ManualReviewOutcome',
  'B10AssessmentOutcome',
  'B10ChoiceResponse',
  'B10MatchingPair',
  'B10MatchingResponse',
  'B10OrderingResponse',
  'B10ClozeEntry',
  'B10ClozeResponse',
  'B10TextResponse',
  'B10UnansweredResponse',
  'B10CandidateResponse',
  'B10ProtectedDraft',
  'B10AssessmentSessionCheckpointRequest',
  'B10AssessmentCheckpoint',
]);
const M1010_EVENT_PAYLOAD_SCHEMA_PROJECTIONS = Object.freeze([
  'B10AssessmentAttemptSubmitted',
  'B10AssessmentAttemptAssessed',
]);
export const M1010_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.x-idempotency","operation x-idempotency contract changed"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.required","new required field: baseStateVersion"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.required","new required field: checkpointVersion"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.required","new required field: clientEventId"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.required","new required field: clientSeq"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.required","new required field: checkpointDigest"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.required","new required field: protectedDraft"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.required","existing required field removed: checkpointSeq"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.required","existing required field removed: clientStateHash"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.description","description contract changed"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.properties.checkpointSeq","existing property removed"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.properties.currentExerciseId","existing property removed"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.properties.clientState","existing property removed"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.properties.clientStateHash","existing property removed"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/checkpoint.request.properties.monotonicElapsedMs","existing property removed"],
  ["POST /api/v1/assessment/sessions/{sessionId}/attempts.request.required","new required field: submissionDigest"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint.request.description","description contract changed"],
  ["PUT /api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint.request.deprecated","deprecated contract changed"],
  ["components.schemas.B10RuleContract.required","new required field: answerRuleVersion"],
  ["components.schemas.B10RuleContract.required","existing required field removed: ruleVersion"],
  ["components.schemas.B10RuleContract.properties.ruleVersion","existing property removed"],
  ["components.schemas.B10AssessmentContentSnapshot.required","new required field: answerRuleSetVersion"],
  ["components.schemas.B10AssessmentContentSnapshot.required","existing required field removed: gradingRuleSetVersion"],
  ["components.schemas.B10AssessmentContentSnapshot.properties.gradingRuleSetVersion","existing property removed"],
  ["components.schemas.B10AssessmentSession.required","new required field: itemRulePins"],
  ["components.schemas.B10AssessmentSession.required","new required field: answerRuleSetVersion"],
  ["components.schemas.B10AssessmentSession.required","new required field: completionRuleVersion"],
  ["components.schemas.B10AssessmentSession.description","description contract changed"],
  ["components.schemas.B10AssessmentSession.x-p1r-state-machine","unknown schema keyword or extension changed"],
  ["components.schemas.B10AssessmentSession.properties.status","type changed from string to <unspecified>"],
  ["components.schemas.B10AssessmentSession.properties.status.enum","enum contract changed from specified to unspecified"],
  ["components.schemas.B10AssessmentSession.properties.status.$ref","$ref contract changed"],
  ["components.schemas.B10AttemptSubmission.required","new required field: responseType"],
  ["components.schemas.B10AttemptSubmission.required","new required field: responseDigest"],
  ["components.schemas.B10AttemptSubmission.required","existing required field removed: response"],
  ["components.schemas.B10AttemptSubmission.description","description contract changed"],
  ["components.schemas.B10AttemptSubmission.oneOf","oneOf contract changed"],
  ["components.schemas.B10AttemptSubmission.not","not contract changed"],
  ["components.schemas.B10AttemptSubmission.properties.response","existing property removed"],
  ["components.schemas.B10AttemptSubmission.properties.clientSubmissionId","existing property removed"],
  ["components.schemas.B10SubmitAttemptRequest.required","new required field: submissionDigest"],
  ["components.schemas.B10Attempt.required","new required field: submissionId"],
  ["components.schemas.B10Attempt.required","new required field: itemRulePins"],
  ["components.schemas.B10Attempt.required","new required field: answerRuleSetVersion"],
  ["components.schemas.B10Attempt.required","new required field: completionRuleVersion"],
  ["components.schemas.B10Attempt.description","description contract changed"],
  ["components.schemas.B10Attempt.oneOf","oneOf contract changed"],
  ["components.schemas.B10Attempt.x-p1r-state-machine","unknown schema keyword or extension changed"],
  ["components.schemas.B10Attempt.properties.status","type changed from string to <unspecified>"],
  ["components.schemas.B10Attempt.properties.status.enum","enum contract changed from specified to unspecified"],
  ["components.schemas.B10Attempt.properties.status.$ref","$ref contract changed"],
  ["components.schemas.B10Attempt.properties.assessmentVersion","type changed from string to <unspecified>"],
  ["components.schemas.B10Attempt.properties.assessmentVersion.$ref","$ref contract changed"],
  ["components.schemas.B10Attempt.properties.assessmentVersion.maxLength","maxLength contract changed"],
  ["components.schemas.B10Attempt.properties.scoreBucket","existing property removed"],
  ["components.schemas.B10Attempt.properties.reportId.nullable","nullable contract changed"],
  ["components.schemas.B10CheckpointRequest.description","description contract changed"],
  ["components.schemas.B10CheckpointRequest.deprecated","deprecated contract changed"],
  ["components.schemas.B10Checkpoint.description","description contract changed"],
  ["components.schemas.B10Checkpoint.deprecated","deprecated contract changed"],
  ["components.schemas.B10AssessmentReport.required","new required field: sessionId"],
  ["components.schemas.B10AssessmentReport.required","new required field: attemptVersion"],
  ["components.schemas.B10AssessmentReport.required","new required field: submissionId"],
  ["components.schemas.B10AssessmentReport.required","new required field: submissionDigest"],
  ["components.schemas.B10AssessmentReport.required","new required field: reportRuleVersion"],
  ["components.schemas.B10AssessmentReport.required","new required field: assessmentVersion"],
  ["components.schemas.B10AssessmentReport.required","new required field: answerRuleSetVersion"],
  ["components.schemas.B10AssessmentReport.required","new required field: completionRuleVersion"],
  ["components.schemas.B10AssessmentReport.required","new required field: itemRulePins"],
  ["components.schemas.B10AssessmentReport.required","new required field: asOf"],
  ["components.schemas.B10AssessmentReport.required","new required field: assessmentFactWatermark"],
  ["components.schemas.B10AssessmentReport.required","existing required field removed: scoreBucket"],
  ["components.schemas.B10AssessmentReport.required","existing required field removed: mistakeCodes"],
  ["components.schemas.B10AssessmentReport.description","description contract changed"],
  ["components.schemas.B10AssessmentReport.oneOf","oneOf contract changed"],
  ["components.schemas.B10AssessmentReport.x-p1r-state-machine","unknown schema keyword or extension changed"],
  ["components.schemas.B10AssessmentReport.properties.status","type changed from string to <unspecified>"],
  ["components.schemas.B10AssessmentReport.properties.status.enum","enum contract changed from specified to unspecified"],
  ["components.schemas.B10AssessmentReport.properties.status.$ref","$ref contract changed"],
  ["components.schemas.B10AssessmentReport.properties.scoreBucket","existing property removed"],
  ["components.schemas.B10AssessmentReport.properties.masterySignal","existing property removed"],
]);
export const M1010_EVENT_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ["assessment.attempt.submitted.v1.compatibility","existing compatibility policy changed"],
  ["assessment.attempt.submitted.v1.payload.required","new required field: snapshotId"],
  ["assessment.attempt.submitted.v1.payload.required","new required field: snapshotHash"],
  ["assessment.attempt.submitted.v1.payload.required","new required field: pin"],
  ["assessment.attempt.submitted.v1.payload.required","new required field: submissionId"],
  ["assessment.attempt.submitted.v1.payload.required","new required field: answerRuleSetVersion"],
  ["assessment.attempt.submitted.v1.payload.required","new required field: answerRuleVersion"],
  ["assessment.attempt.submitted.v1.payload.required","new required field: ruleDigest"],
  ["assessment.attempt.submitted.v1.payload.required","new required field: completionRuleVersion"],
  ["assessment.attempt.submitted.v1.payload.required","existing required field removed: contentSnapshotId"],
  ["assessment.attempt.submitted.v1.payload.required","existing required field removed: gradingRuleVersion"],
  ["assessment.attempt.assessed.v1.compatibility","existing compatibility policy changed"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: contentEpoch"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: snapshotId"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: snapshotHash"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: pin"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: submissionId"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: submissionDigest"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: answerRuleSetVersion"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: answerRuleVersion"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: ruleDigest"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: completionRuleVersion"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: reportId"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: reportVersion"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: reportRuleVersion"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: reportStatus"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: reportDigest"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: asOf"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: assessmentFactWatermark"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: outcomeKind"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: objectiveNumerator"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: objectiveDenominator"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: errorCategory"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: reasonTrace"],
  ["assessment.attempt.assessed.v1.payload.required","new required field: outcomeDigest"],
  ["assessment.attempt.assessed.v1.payload.required","existing required field removed: contentSnapshotId"],
  ["assessment.attempt.assessed.v1.payload.required","existing required field removed: masterySignal"],
  ["assessment.attempt.assessed.v1.payload.properties.scoreBucket.enum","existing enum value removed: PENDING_REVIEW"],
  ["assessment.attempt.assessed.v1.payload.properties.masterySignal","existing property removed"],
]);

export const M1011_LEARNER_PLANNING_PROMOTION_ID = 'M1-011_LEARNER_PLANNING_CONTRACT_PROMOTION';
export const M1011_SOURCE_CONTRACT_BASELINE_REF = 'cd92378bd8ba0c57c920fc6e79db52de717b0b05';
export const M1011_OPENAPI_SOURCE_SEMANTIC_SHA256 = '55dc56fffdd3f94898e62149b48ac400af5eada2a969c396205939ba41f115ed';
export const M1011_OPENAPI_EXPECTED_SEMANTIC_SHA256 = '7b0fef0a9bd909af9731d8cb267ae75e5c497af6115c62af8fe135c290ff87fa';
export const M1011_EVENT_SOURCE_SEMANTIC_SHA256 = 'bba617d505acd04ac14a2c3c5e261c02e6ab8a075c5c551fe05eabe849024470';
export const M1011_EVENT_EXPECTED_SEMANTIC_SHA256 = '765e95bdcfcd469b9729749b05941247cbc542bc81f4cee8c82d1be76545021b';
export const M1011_B26_SOURCE_SEMANTIC_SHA256 = '0df8b346a75777a5d75c4370de63a6b8370f640f025252698f1449e1d2b7cb61';
export const M1011_B26_EXPECTED_SEMANTIC_SHA256 = '8eef8ce82150d5b82a8c2b7e8d0cfbaace0720d684852dae307d5bcd2e334917';
export const M1011_LEARNER_EVENT_NAMES = Object.freeze([
  'learner.target.updated.v1',
  'learner.first_day.projected.v1',
]);
const M1011_OPENAPI_APPROVED_PATH_PROJECTIONS = Object.freeze([
  '/api/v1/learner/first-day/recovery/{recoveryTaskId}',
  '/api/v1/learner/goal-options',
  '/api/v1/learner/first-day',
  '/api/v1/learner/home',
  '/api/v1/learner/preferences',
  '/api/v1/learner/profile',
  '/api/v1/learner/targets',
  '/api/v1/onboarding/goals/first',
  '/api/v1/onboarding/options',
  '/api/v1/onboarding/profile',
]);
const M1011_OPENAPI_APPROVED_PARAMETER_PROJECTIONS = Object.freeze([
  'B9IfMatch',
]);
const M1011_OPENAPI_APPROVED_SCHEMA_PROJECTIONS = Object.freeze([
  'B9FirstDayProjectionCommon',
  'B9FirstDayRecovery',
  'B9GoalOption',
  'B9GoalOptions',
  'B9PlanReference',
  'B9PlanningInputSnapshot',
  'B9PlanningJobRef',
  'B1OnboardingProfileRequest',
  'B9FirstDayProjection',
  'B9LearnerPreferences',
  'B9LearnerPreferencesPatch',
  'B9LearnerProfile',
  'B9LearnerProfilePatch',
  'B9LearnerTarget',
  'B9LearnerTargetUpsert',
]);
const M1011_EVENT_PAYLOAD_SCHEMA_PROJECTIONS = Object.freeze([
  'B9LearnerFirstDayProjected',
  'B9LearnerTargetUpdated',
]);
const M1011_EVENT_ROOT_PROJECTIONS = Object.freeze([
  'x-p1r-event-governance',
]);
const M1011_ASYNCAPI_CHANNEL_PROJECTIONS = Object.freeze([
  'learner_target_updated_v1',
]);
const M1011_ASYNCAPI_OPERATION_PROJECTIONS = Object.freeze([
  'publish_learner_target_updated_v1',
  'subscribe_learner_target_updated_v1_cg_learning_from_learner_v1',
  'subscribe_learner_target_updated_v1_cg_workflow_from_learner_v1',
]);
const M1011_PROMOTION_ALLOWANCE_KEYS = Object.freeze([
  'id',
  'sourceContractBaseline',
  'previousPromotion',
  'runtimeStatus',
  'scope',
  'eventCatalogDecision',
  'canonicalFragment',
  'legacyAdapterFragment',
  'historicalEventFragment',
]);

export const M1012_PLACEMENT_PROMOTION_ID = 'P1R-M1-012';
export const M1012_SOURCE_CONTRACT_BASELINE_REF = '270b0dfbf8dbec1329b8dc7036ee3e7490a8ffb3';
export const M1012_IMMUTABLE_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const M1012_OPENAPI_SOURCE_SEMANTIC_SHA256 = '7b0fef0a9bd909af9731d8cb267ae75e5c497af6115c62af8fe135c290ff87fa';
export const M1012_OPENAPI_EXPECTED_SEMANTIC_SHA256 = '651e76fc53f921536687b37d8a961eacb8216912f185ae42f60026e28979eabd';
export const M1012_EVENT_SOURCE_SEMANTIC_SHA256 = '765e95bdcfcd469b9729749b05941247cbc542bc81f4cee8c82d1be76545021b';
export const M1012_EVENT_EXPECTED_SEMANTIC_SHA256 = '9f9767cbca34b9793e3477691d78d5d6759b357adf5c8ec62f376a0f539caa2e';
export const M1012_B26_SOURCE_SEMANTIC_SHA256 = '8eef8ce82150d5b82a8c2b7e8d0cfbaace0720d684852dae307d5bcd2e334917';
export const M1012_B26_EXPECTED_SEMANTIC_SHA256 = '599058853cbd9c829ca5b8addba6434c61d0593e5ea62d5585b2c8fa9904b620';
export const M1012_PLACEMENT_EVENT_NAME = 'assessment.placement.completed.v1';

const M1012_OPENAPI_ADDED_PATH_PROJECTIONS = Object.freeze([
  '/api/v1/assessment/placement/sessions',
  '/api/v1/assessment/placement/sessions/{sessionId}',
  '/api/v1/assessment/placement/sessions/{sessionId}/responses',
  '/api/v1/assessment/placement/baselines/skip',
  '/api/v1/assessment/placement/reports/{reportId}',
]);
const M1012_OPENAPI_CHANGED_PATH_PROJECTIONS = Object.freeze([
  '/api/v1/assessment/placement/start',
  '/api/v1/assessment/placement/submit-step',
  '/api/v1/assessment/placement/skip',
  '/api/v1/assessment/placement/report/{sessionId}',
]);
const M1012_OPENAPI_ADDED_SCHEMA_PROJECTIONS = Object.freeze([
  'B9PlacementBaseline',
  'B10PlacementDigest',
  'B10PlacementManifestDimension',
  'B10PlacementManifest',
  'B10PlacementManifestPin',
  'B10PlacementContentPin',
  'B10PlacementAnswerRulePin',
  'B10PlacementTargetPin',
  'B10PlacementSession',
  'B10PlacementResponseSubmitRequest',
  'B10PlacementDimensionSummary',
  'B10RequestedStartingLevel',
  'B10PlacementResult',
  'B10PlacementResponseReceipt',
  'B10PlacementSkipBaselineRequest',
  'B10PlacementReport',
]);
const M1012_OPENAPI_CHANGED_SCHEMA_PROJECTIONS = Object.freeze([
  'B9PlanningInputSnapshot',
  'B9FirstDayProjectionCommon',
]);
const M1012_EVENT_PAYLOAD_SCHEMA = 'B10PlacementCompleted';
const M1012_ASYNCAPI_CHANNEL = 'assessment_placement_completed_v1';
const M1012_ASYNCAPI_OPERATIONS = Object.freeze([
  'publish_assessment_placement_completed_v1',
  'subscribe_assessment_placement_completed_v1_cg_learning_from_assessment_v1',
  'subscribe_assessment_placement_completed_v1_cg_workflow_from_assessment_v1',
]);
const M1012_PROMOTION_ALLOWANCE_KEYS = Object.freeze([
  'id',
  'sourceContractBaseline',
  'previousPromotion',
  'immutableGovernanceBaseline',
  'runtimeStatus',
  'scope',
  'canonicalFragment',
  'legacyAdapterFragments',
  'planningFragment',
  'eventFragment',
  'b26StaticPolicy',
]);

// M1-013 source-bound promotion.  These constants are intentionally kept in
// the compatibility tool (rather than inferred from the working tree) so the
// mutable policy can only describe a previously frozen machine boundary.
export const M1013_LEARNING_LOOP_PROMOTION_ID = 'P1R-M1-013';
export const M1013_SOURCE_CONTRACT_BASELINE_REF = 'a07a58a7d245295c54d39487a6669545d077c513';
export const M1013_IMMUTABLE_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const M1013_OPENAPI_SOURCE_SEMANTIC_SHA256 = '651e76fc53f921536687b37d8a961eacb8216912f185ae42f60026e28979eabd';
export const M1013_EVENT_SOURCE_SEMANTIC_SHA256 = '9f9767cbca34b9793e3477691d78d5d6759b357adf5c8ec62f376a0f539caa2e';
export const M1013_B26_SOURCE_SEMANTIC_SHA256 = '599058853cbd9c829ca5b8addba6434c61d0593e5ea62d5585b2c8fa9904b620';

export const M1013_APPROVED_CANONICAL_EVENTS = Object.freeze([
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

export const M1013_CANONICAL_ROUTE_PROJECTIONS = Object.freeze([
  Object.freeze({ id: 'B10-REVIEW-QUEUE-LIST', method: 'GET', path: '/api/v1/learning/review-queue', operationId: 'listB10LearningReviewQueue' }),
  Object.freeze({ id: 'B10-REVIEW-COMPLETE', method: 'POST', path: '/api/v1/learning/review-queue/{queueItemId}/complete', operationId: 'completeB10LearningReview' }),
  Object.freeze({ id: 'B10-MASTERY-ITEM', method: 'GET', path: '/api/v1/learning/mastery/{itemId}', operationId: 'getB10LearningMasteryProjection' }),
  Object.freeze({ id: 'B10-PLAN-CURRENT', method: 'GET', path: '/api/v1/learning/plans/current', operationId: 'getB10LearningPlan' }),
  Object.freeze({ id: 'B10-TODAY', method: 'GET', path: '/api/v1/learning/today', operationId: 'getB10LearningToday' }),
  Object.freeze({ id: 'B10-PLAN-REORDER', method: 'POST', path: '/api/v1/learning/plans/reorder', operationId: 'reorderB10LearningPlan' }),
  Object.freeze({ id: 'B10-TASK-COMPLETE', method: 'POST', path: '/api/v1/learning/tasks/{taskId}/complete', operationId: 'completeB10LearningTask' }),
  Object.freeze({ id: 'B10-REPAIR-LIST', method: 'GET', path: '/api/v1/learning/repairs', operationId: 'listB10LearningRepairs' }),
  Object.freeze({ id: 'B10-REPAIR-DETAIL', method: 'GET', path: '/api/v1/learning/repairs/{repairId}', operationId: 'getB10LearningRepair' }),
  Object.freeze({ id: 'B10-MASTERY-OVERVIEW', method: 'GET', path: '/api/v1/learning/mastery', operationId: 'getB10LearningMasteryOverview' }),
  Object.freeze({ id: 'B10-REPORT', method: 'GET', path: '/api/v1/learning/reports/{reportType}', operationId: 'getB10LearningReport' }),
]);

export const M1013_LEGACY_ADAPTER_PROJECTIONS = Object.freeze([
  Object.freeze({ id: 'LEGACY-B1-DAILY-TASKS-TODAY', method: 'GET', path: '/api/v1/onboarding/daily-tasks/today', operationId: 'getB1DailyTasks' }),
  Object.freeze({ id: 'LEGACY-B1-DAILY-TASK-COMPLETE', method: 'POST', path: '/api/v1/onboarding/daily-tasks/{taskId}/complete', operationId: 'completeB1DailyTask' }),
  Object.freeze({ id: 'LEGACY-B1-DAILY-TASKS-REORDER', method: 'POST', path: '/api/v1/onboarding/daily-tasks/reorder', operationId: 'reorderB1DailyTasks' }),
  Object.freeze({ id: 'LEGACY-B2-CURRENT-LEARNING-PLAN', method: 'GET', path: '/api/v1/learning/plan/current', operationId: 'getCurrentLearningPlan' }),
  Object.freeze({ id: 'LEGACY-B2-TODAY-LEARNING-STREAM', method: 'GET', path: '/api/v1/learning/stream/today', operationId: 'getTodayLearningStream' }),
  Object.freeze({ id: 'LEGACY-B2-SUBMIT-LEARNING-STREAM-ACTION', method: 'POST', path: '/api/v1/learning/stream/action', operationId: 'submitLearningStreamAction' }),
  Object.freeze({ id: 'LEGACY-B2-LEARNING-MISTAKE-QUEUE', method: 'GET', path: '/api/v1/learning/mistakes/queue', operationId: 'getLearningMistakeQueue' }),
  Object.freeze({ id: 'LEGACY-B2-VERIFY-LEARNING-MISTAKE', method: 'POST', path: '/api/v1/learning/mistakes/verify', operationId: 'verifyLearningMistake' }),
  Object.freeze({ id: 'LEGACY-B2-DAILY-LEARNING-SUMMARY', method: 'GET', path: '/api/v1/learning/stats/daily-summary', operationId: 'getDailyLearningSummary' }),
  Object.freeze({ id: 'LEGACY-B2-CREATE-SRS-BATCH', method: 'POST', path: '/api/v1/learning/srs/batches', operationId: 'createSrsBatch' }),
  Object.freeze({ id: 'LEGACY-B2-GET-SRS-BATCH', method: 'GET', path: '/api/v1/learning/srs/batches/{snapshotId}', operationId: 'getSrsBatch' }),
  Object.freeze({ id: 'LEGACY-B2-SUBMIT-REVIEW-EVENT', method: 'POST', path: '/api/v1/learning/srs/reviews', operationId: 'submitReviewEvent' }),
  Object.freeze({ id: 'LEGACY-B2-SYNC-REVIEW-EVENTS', method: 'POST', path: '/api/v1/learning/srs/reviews:sync', operationId: 'syncReviewEvents' }),
  Object.freeze({ id: 'LEGACY-B2-LIST-SRS-STATES', method: 'GET', path: '/api/v1/learning/srs/states', operationId: 'listSrsStates' }),
  Object.freeze({ id: 'LEGACY-B2-GET-SRS-OVERVIEW', method: 'GET', path: '/api/v1/learning/srs/overview', operationId: 'getSrsOverview' }),
  Object.freeze({ id: 'LEGACY-B2-DAILY-STREAM', method: 'GET', path: '/api/v1/assessment/daily-stream', operationId: 'getB2DailyStream' }),
  Object.freeze({ id: 'LEGACY-B2-MASTERY-OVERVIEW', method: 'GET', path: '/api/v1/mastery/overview', operationId: 'getB2MasteryOverview' }),
  Object.freeze({ id: 'LEGACY-B2-MISTAKES', method: 'GET', path: '/api/v1/mastery/mistakes', operationId: 'listB2Mistakes' }),
  Object.freeze({ id: 'LEGACY-B2-MISTAKE-DETAIL', method: 'GET', path: '/api/v1/mastery/mistakes/{mistakeId}', operationId: 'getB2MistakeDetail' }),
  Object.freeze({ id: 'LEGACY-B2-MISTAKE-RETRY', method: 'POST', path: '/api/v1/mastery/mistakes/{mistakeId}/retry', operationId: 'startB2MistakeRetry' }),
  Object.freeze({ id: 'LEGACY-B2-MASTERY-VERIFICATIONS', method: 'GET', path: '/api/v1/mastery/verifications', operationId: 'listB2MasteryVerifications' }),
  Object.freeze({ id: 'LEGACY-B2-SUBMIT-MASTERY-VERIFICATION', method: 'POST', path: '/api/v1/mastery/verifications/{verificationId}/submit', operationId: 'submitB2MasteryVerification' }),
  Object.freeze({ id: 'LEGACY-B2-DAILY-REPORT', method: 'GET', path: '/api/v1/learning/stats/daily-report', operationId: 'getB2DailyReport' }),
  Object.freeze({ id: 'LEGACY-B2-WEEKLY-REPORT', method: 'GET', path: '/api/v1/learning/stats/weekly-report', operationId: 'getB2WeeklyReport' }),
]);

export const M1013_OPENAPI_APPROVED_PARAMETER_PROJECTIONS = Object.freeze([
  'B10TaskId', 'B10RepairId', 'B10ReportType',
]);
export const M1013_OPENAPI_APPROVED_SCHEMA_PROJECTIONS = Object.freeze([
  'SrsState', 'ReviewEventRequest', 'SrsBatchCreateRequest', 'SrsBatchItem', 'ReviewEventResponse', 'SrsOverview',
  'B10LearningQueueItem', 'B10CompleteReviewRequest', 'B10MasteryProjection',
  'B10ReviewEventId', 'B10TaskId', 'B10RepairId', 'B10PlanId', 'B10LearningReportType', 'B10LearningPlanStatus',
  'B10LearningTaskStatus', 'B10ReviewContentPin', 'B10SourceWatermark', 'B10LearningPlanTask', 'B10LearningPlan',
  'B10TodayLearningPlan', 'B10PlanReorderRequest', 'B10PlanReorderResult', 'B10TaskCompletionRequest',
  'B10TaskCompletionResult', 'B10RepairItem', 'B10MasteryOverview', 'B10ReportInputVersions', 'B10LearningReportMetric',
  'B10LearningReport', 'B10LearningReviewResult',
]);
export const M1013_EVENT_PAYLOAD_SCHEMA_PROJECTIONS = Object.freeze([
  'B10AssessmentItemAssessedV2', 'B10LearningMasteryProjectedV2', 'B10LearningReviewScheduledV2',
]);
export const M1013_ASYNCAPI_CHANNEL_PROJECTIONS = Object.freeze([
  'assessment_item_assessed_v2', 'learning_mastery_projected_v2', 'learning_review_scheduled_v2',
]);
export const M1013_ASYNCAPI_OPERATION_PROJECTIONS = Object.freeze([
  'publish_assessment_item_assessed_v2',
  'subscribe_assessment_item_assessed_v2_cg_learning_from_assessment_v1',
  'subscribe_assessment_item_assessed_v2_cg_workflow_from_assessment_v1',
  'publish_learning_mastery_projected_v2',
  'subscribe_learning_mastery_projected_v2_cg_assessment_from_learning_v1',
  'subscribe_learning_mastery_projected_v2_cg_workflow_from_learning_v1',
  'publish_learning_review_scheduled_v2',
  'subscribe_learning_review_scheduled_v2_cg_assessment_from_learning_v1',
  'subscribe_learning_review_scheduled_v2_cg_workflow_from_learning_v1',
]);
export const M1013_EVENT_NAMES = Object.freeze(M1013_APPROVED_CANONICAL_EVENTS.map((event) => event.eventName));
export const M1013_OPENAPI_EXPECTED_SEMANTIC_SHA256 = 'd0b297ae2370bf837d6b1a7dbe1c1776b221060ae10f32c27fb99353fa3a1c40';
export const M1013_EVENT_EXPECTED_SEMANTIC_SHA256 = '961e4a21be0b59d91d75870b96c105514a4f2fdd1be10728ad10b4b49de79720';
export const M1013_B26_EXPECTED_SEMANTIC_SHA256 = '53ba061644bfb91db85a945c778fd2467395dca7c117c56a6db1b1e5612f81c3';
// These digests bind every nested governance field, not just the route/event
// identity tuple.  The policy validator repeats the structural check, while
// direct compareContracts callers use these immutable values to prevent a
// caller-provided allowance from widening owner, permission, security,
// migration, or runtime boundaries.
export const M1013_APPROVED_SOURCE_FILES_SEMANTIC_SHA256 = 'b92f10393a6c8ebd56bab6f230845a449c81ae4c65db80a69e52e24f0ba96ae6';
export const M1013_CANONICAL_ROUTES_SEMANTIC_SHA256 = 'a9237fe0d89985077cee628c303c079821ee03c4270408ff94e49aca7b0ca279';
export const M1013_LEGACY_ADAPTERS_SEMANTIC_SHA256 = '774a15a5ee1e96d3e1c77c356983b8e211da33035db9fddb2bf17f13b4ff9b1f';
export const M1013_HISTORICAL_ONLY_SOURCES_SEMANTIC_SHA256 = '117e7ac7c0e4b7dc21751841161bebe978a6095e07fe0ff938d981ab39c026f1';
export const M1013_PROHIBITED_RUNTIME_CLAIMS_SEMANTIC_SHA256 = 'e1ae8022f8196cd7459a81160241163feb887807469664b02ad8d3e16604f69d';
export const M1013_PROMOTION_ALLOWANCE_KEYS = Object.freeze([
  'id', 'sourceContractBaseline', 'previousPromotion', 'immutableGovernanceBaseline', 'runtimeStatus', 'scope',
  'approvedSourceFiles', 'approvedCanonicalEvents', 'canonicalRoutes', 'legacyAdapters', 'historicalOnlySources',
  'prohibitedRuntimeClaims',
]);
const M1013_OPENAPI_ROUTE_PROJECTIONS = Object.freeze([
  ...M1013_CANONICAL_ROUTE_PROJECTIONS,
  ...M1013_LEGACY_ADAPTER_PROJECTIONS,
]);

// M1-014 is a source-bound promotion from the accepted M1-013 projection.
// Its approval is deliberately expressed as named operation/component/event
// nodes instead of a B4/B12 fragment or path-family allowance.  B4/B12/v1
// therefore remain historical compatibility evidence only.
export const M1014_GAMIFICATION_SOCIAL_PROMOTION_ID = 'P1R-M1-014';
export const M1014_SOURCE_CONTRACT_BASELINE_REF = 'e3514c359e6f6be5445cf46a7734325b2835b941';
export const M1014_IMMUTABLE_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const M1014_OPENAPI_SOURCE_SEMANTIC_SHA256 = 'd0b297ae2370bf837d6b1a7dbe1c1776b221060ae10f32c27fb99353fa3a1c40';
export const M1014_EVENT_SOURCE_SEMANTIC_SHA256 = '961e4a21be0b59d91d75870b96c105514a4f2fdd1be10728ad10b4b49de79720';
export const M1014_B26_SOURCE_SEMANTIC_SHA256 = '53ba061644bfb91db85a945c778fd2467395dca7c117c56a6db1b1e5612f81c3';
export const M1014_OPENAPI_EXPECTED_SEMANTIC_SHA256 = '4ed99e38984eb422b42477d04149301d2ba05cfa1b7af1b7e5ff5344c459d0a4';
export const M1014_EVENT_EXPECTED_SEMANTIC_SHA256 = '88397f7c17eb79f73686904f69983278009ee701c9b0bea2b69e26875206cc0c';
export const M1014_B26_EXPECTED_SEMANTIC_SHA256 = 'cb5b6c24a62997861956a2f5b46b7f1e20c467430ea58caa19018af9e6682a9e';
export const M1014_POLICY_SEMANTIC_SHA256 = 'b4860e3aad81f207fb2a2ff51be2b86ca1f1bdb01123d0d600f921a9846f46cb';
export const M1014_APPROVED_SOURCE_FILES_SEMANTIC_SHA256 = 'dc18726f1db757108aaf45faa904b360572e6791c6e7dca9830e57aa32cc6ff3';
export const M1014_APPROVED_CANONICAL_EVENTS_SEMANTIC_SHA256 = 'e494087315361a21a34f3644b63a74c175863205ed509f47febdffe453eea389';
export const M1014_CANONICAL_ROUTES_SEMANTIC_SHA256 = '7b2e9226430d3df7a62e127678a93cbd3c92a45c172ac6ec0404105f04915eb1';
export const M1014_LEGACY_ADAPTERS_SEMANTIC_SHA256 = '4a15d8eb382b6e843fe98aff483b53e39bca4c9c55ff2276a5a4af8829fc6568';
export const M1014_HISTORICAL_ONLY_SOURCES_SEMANTIC_SHA256 = 'becf1429f5a428dc26f3c198a7f947f177ba65878e2d263c1db8d308f8d6d26c';
export const M1014_PROHIBITED_RUNTIME_CLAIMS_SEMANTIC_SHA256 = '6b722d00f757fc468a89e0e5f27c80306b7c061254a0f5c66490b13520b9bfe9';
export const M1014_B26_STATIC_POLICY_SEMANTIC_SHA256 = 'a967b692a61463029d4d899d8ebe32fbad0b57d1113824be5c9ad8a9dea4387e';
export const M1014_PROMOTION_ALLOWANCE_KEYS = Object.freeze([
  'id', 'sourceContractBaseline', 'previousPromotion', 'immutableGovernanceBaseline', 'runtimeStatus', 'scope',
  'approvedSourceFiles', 'approvedCanonicalEvents', 'canonicalRoutes', 'legacyAdapters', 'historicalOnlySources',
  'prohibitedRuntimeClaims', 'b26StaticPolicy',
]);
export const M1014_CANONICAL_ROUTE_PROJECTIONS = Object.freeze([
  Object.freeze({ id: 'M1014-GAM-SUMMARY', method: 'GET', path: '/api/v1/gamification/me/summary', operationId: 'getM1014GamificationSummary' }),
  Object.freeze({ id: 'M1014-GAM-LEDGER-LIST', method: 'GET', path: '/api/v1/gamification/me/ledger', operationId: 'listM1014GamificationLedger' }),
  Object.freeze({ id: 'M1014-GAM-REWARD-LIST', method: 'GET', path: '/api/v1/gamification/me/rewards', operationId: 'listM1014RewardGrants' }),
  Object.freeze({ id: 'M1014-GAM-REWARD-PROBABILITY', method: 'GET', path: '/api/v1/gamification/me/rewards/{grantId}/probability', operationId: 'getM1014RewardProbability' }),
  Object.freeze({ id: 'M1014-GAM-REWARD-CLAIM', method: 'POST', path: '/api/v1/gamification/me/rewards/{grantId}/claim', operationId: 'claimM1014Reward' }),
  Object.freeze({ id: 'M1014-GAM-TRUSTED-COMPLETION', method: 'POST', path: '/internal/v1/gamification/trusted-events/completions', operationId: 'settleM1014TrustedCompletion' }),
  Object.freeze({ id: 'M1014-SOC-ROOM-DISCONNECT', method: 'POST', path: '/api/v1/social/rooms/{roomId}/disconnect', operationId: 'disconnectM1014StudyRoom' }),
  Object.freeze({ id: 'M1014-SOC-ROOM-RECOVER', method: 'POST', path: '/api/v1/social/rooms/{roomId}/recover', operationId: 'recoverM1014StudyRoomSeat' }),
  Object.freeze({ id: 'M1014-SOC-LEASE-RENEW', method: 'POST', path: '/api/v1/social/rooms/{roomId}/lease/renew', operationId: 'renewM1014StudyRoomLease' }),
  Object.freeze({ id: 'M1014-SOC-FOCUS-START', method: 'POST', path: '/api/v1/social/rooms/{roomId}/focus', operationId: 'startM1014RoomFocus' }),
  Object.freeze({ id: 'M1014-SOC-FOCUS-UPDATE', method: 'PATCH', path: '/api/v1/social/rooms/{roomId}/focus', operationId: 'updateM1014RoomFocus' }),
  Object.freeze({ id: 'M1014-SOC-PRESET-INTERACTION', method: 'POST', path: '/api/v1/social/rooms/{roomId}/interactions', operationId: 'recordM1014RoomInteraction' }),
  Object.freeze({ id: 'M1014-SOC-LEADERBOARD-LIST', method: 'GET', path: '/api/v1/social/leaderboards', operationId: 'getM1014Leaderboard' }),
  Object.freeze({ id: 'M1014-SOC-VISIBILITY-UPDATE', method: 'PATCH', path: '/api/v1/social/me/visibility', operationId: 'updateM1014SocialVisibility' }),
  Object.freeze({ id: 'M1014-SOC-REPORT-CREATE', method: 'POST', path: '/api/v1/social/rooms/{roomId}/reports', operationId: 'createM1014SocialReport' }),
  Object.freeze({ id: 'M1014-SOC-REPORT-GET', method: 'GET', path: '/api/v1/social/reports/{reportId}', operationId: 'getM1014SocialReport' }),
  Object.freeze({ id: 'M1014-SOC-TRUSTED-EVENT', method: 'POST', path: '/internal/v1/social/trusted-events', operationId: 'consumeM1014SocialTrustedEvent' }),
  Object.freeze({ id: 'M1014-GAM-GAME-CATALOG', method: 'GET', path: '/api/v1/games/catalog', operationId: 'listM1014GameCatalog' }),
  Object.freeze({ id: 'M1014-GAM-GAME-SESSION-CREATE', method: 'POST', path: '/api/v1/games/sessions', operationId: 'createM1014GameSession' }),
  Object.freeze({ id: 'M1014-GAM-GAME-SESSION-GET', method: 'GET', path: '/api/v1/games/sessions/{sessionId}', operationId: 'getM1014GameSession' }),
  Object.freeze({ id: 'M1014-GAM-GAME-EVENT-SUBMIT', method: 'POST', path: '/api/v1/games/sessions/{sessionId}/events', operationId: 'submitM1014GameEvent' }),
  Object.freeze({ id: 'M1014-GAM-GAME-SESSION-PAUSE', method: 'POST', path: '/api/v1/games/sessions/{sessionId}/pause', operationId: 'pauseM1014GameSession' }),
  Object.freeze({ id: 'M1014-GAM-GAME-SESSION-RESUME', method: 'POST', path: '/api/v1/games/sessions/{sessionId}/resume', operationId: 'resumeM1014GameSession' }),
  Object.freeze({ id: 'M1014-GAM-GAME-SESSION-FINISH', method: 'POST', path: '/api/v1/games/sessions/{sessionId}/finish', operationId: 'finishM1014GameSession' }),
  Object.freeze({ id: 'M1014-SOC-ROOM-LIST', method: 'GET', path: '/api/v1/social/rooms', operationId: 'listM1014StudyRooms' }),
  Object.freeze({ id: 'M1014-SOC-ROOM-GET', method: 'GET', path: '/api/v1/social/rooms/{roomId}', operationId: 'getM1014StudyRoom' }),
  Object.freeze({ id: 'M1014-SOC-ROOM-JOIN', method: 'POST', path: '/api/v1/social/rooms/{roomId}/join', operationId: 'joinM1014StudyRoom' }),
  Object.freeze({ id: 'M1014-SOC-ROOM-LEAVE', method: 'POST', path: '/api/v1/social/rooms/{roomId}/leave', operationId: 'leaveM1014StudyRoom' }),
]);
export const M1014_OPENAPI_PARAMETER_PROJECTIONS = Object.freeze([
  'M1014GrantId', 'M1014IdempotencyKey', 'M1014LeaderboardKind', 'M1014LeaderboardPeriod',
  'M1014OptionalRoomId', 'M1014ReportId', 'M1014RoomId', 'M1014SessionId',
]);
const M1014_OPENAPI_PROHIBITED_PARAMETER_ALIASES = Object.freeze(['M1014Cursor', 'M1014PageSize']);
export const M1014_OPENAPI_SCHEMA_PROJECTIONS = Object.freeze([
  'M1014FocusCommand', 'M1014FocusSession', 'M1014FocusUpdateCommand', 'M1014GameCatalog', 'M1014GameCatalogItem',
  'M1014GameEventReceipt', 'M1014GameEventRequest', 'M1014GameSession', 'M1014GameSessionControlRequest',
  'M1014GameSessionCreateRequest', 'M1014GameSessionResult', 'M1014GrowthSummary', 'M1014InteractionResult',
  'M1014Leaderboard', 'M1014LeaderboardEntry', 'M1014LedgerEntry', 'M1014PresetInteraction', 'M1014Report',
  'M1014ReportCommand', 'M1014RewardClaimRequest', 'M1014RewardClaimResult', 'M1014RewardGrant',
  'M1014RewardProbability', 'M1014RoomCommand', 'M1014RoomDetails', 'M1014RoomJoinRequest', 'M1014RoomPage',
  'M1014RoomState', 'M1014RoomSummary', 'M1014SettlementResult', 'M1014TrustedCompletion',
  'M1014TrustedSocialEvent', 'M1014Visibility', 'M1014VisibilityCommand', 'M1014LeaderboardMasteryFact',
  'M1014LeaderboardXpFact',
]);
const M1014_OPENAPI_TAG_PROJECTIONS = Object.freeze(['M1-014-GAM', 'M1-014-SOC']);
export const M1014_REPLACED_EVENT_NAMES = Object.freeze([
  'assessment.item.assessed.v2',
  'learning.mastery.projected.v2',
]);
export const M1014_NEW_EVENT_NAMES = Object.freeze([
  'learning.task.completed.v2',
  'gamification.xp.ledger_posted.v2',
  'gamification.reward.granted.v2',
  'study_room.seat_joined.v2',
  'study_room.focus_started.v2',
  'study_room.seat_left.v2',
  'leaderboard.snapshot_published.v2',
  'social.report.created.v2',
]);
export const M1014_EVENT_PAYLOAD_SCHEMA_PROJECTIONS = Object.freeze([
  'M1014LearningTaskCompleted', 'M1014GamificationXpLedgerPosted', 'M1014GamificationRewardGranted',
  'M1014StudyRoomSeatJoined', 'M1014StudyRoomFocusStarted', 'M1014StudyRoomSeatLeft',
  'M1014LeaderboardSnapshotPublished', 'M1014SocialReportCreated',
]);
export const M1014_ASYNCAPI_CHANNEL_PROJECTIONS = Object.freeze([
  'learning_task_completed_v2', 'gamification_xp_ledger_posted_v2', 'gamification_reward_granted_v2',
  'study_room_seat_joined_v2', 'study_room_focus_started_v2', 'study_room_seat_left_v2',
  'leaderboard_snapshot_published_v2', 'social_report_created_v2',
]);
export const M1014_ASYNCAPI_OPERATION_PROJECTIONS = Object.freeze([
  'publish_learning_task_completed_v2',
  'subscribe_learning_task_completed_v2_cg_gamification_from_learning_v1',
  'subscribe_learning_task_completed_v2_cg_workflow_from_learning_v1',
  'publish_gamification_xp_ledger_posted_v2',
  'subscribe_gamification_xp_ledger_posted_v2_cg_audit_from_gamification_v1',
  'subscribe_gamification_xp_ledger_posted_v2_cg_workflow_from_gamification_v1',
  'publish_gamification_reward_granted_v2',
  'subscribe_gamification_reward_granted_v2_cg_audit_from_gamification_v1',
  'subscribe_gamification_reward_granted_v2_cg_workflow_from_gamification_v1',
  'publish_study_room_seat_joined_v2',
  'subscribe_study_room_seat_joined_v2_cg_analytics_from_social_v1',
  'subscribe_study_room_seat_joined_v2_cg_audit_from_social_v1',
  'subscribe_study_room_seat_joined_v2_cg_workflow_from_social_v1',
  'publish_study_room_focus_started_v2',
  'subscribe_study_room_focus_started_v2_cg_analytics_from_social_v1',
  'subscribe_study_room_focus_started_v2_cg_audit_from_social_v1',
  'subscribe_study_room_focus_started_v2_cg_workflow_from_social_v1',
  'publish_study_room_seat_left_v2',
  'subscribe_study_room_seat_left_v2_cg_analytics_from_social_v1',
  'subscribe_study_room_seat_left_v2_cg_audit_from_social_v1',
  'subscribe_study_room_seat_left_v2_cg_workflow_from_social_v1',
  'publish_leaderboard_snapshot_published_v2',
  'subscribe_leaderboard_snapshot_published_v2_cg_analytics_from_social_v1',
  'subscribe_leaderboard_snapshot_published_v2_cg_audit_from_social_v1',
  'subscribe_leaderboard_snapshot_published_v2_cg_workflow_from_social_v1',
  'publish_social_report_created_v2',
  'subscribe_social_report_created_v2_cg_admin_ops_from_social_v1',
  'subscribe_social_report_created_v2_cg_audit_from_social_v1',
  'subscribe_social_report_created_v2_cg_workflow_from_social_v1',
  'subscribe_assessment_item_assessed_v2_cg_gamification_from_assessment_v1',
  'subscribe_learning_mastery_projected_v2_cg_gamification_from_learning_v1',
  'subscribe_learning_mastery_projected_v2_cg_social_from_learning_v1',
  'subscribe_gamification_xp_ledger_posted_v2_cg_social_from_gamification_v1',
]);
const M1014_B26_ADDED_TOPIC_PROJECTIONS = Object.freeze(['platform.gamification.v1', 'platform.social.v1']);
const M1014_B26_REPLACED_TOPIC_PROJECTIONS = Object.freeze(['platform.assessment.v1', 'platform.learning.v1']);

// M1-015 is a source-bound commerce promotion from the fully integrated
// M1-014 checkpoint.  The promotion is deliberately expressed as named
// operation/component/event/topic nodes.  B5/B13 v1 and B20 remain historical
// or static inputs; they are never promoted by this allowance.
export const M1015_COMMERCE_PROMOTION_ID = 'P1R-M1-015';
export const M1015_SOURCE_CONTRACT_BASELINE_REF = '5d0bb3a0651d9205a942eca9d8e1c56b538ed73f';
export const M1015_IMMUTABLE_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const M1015_OPENAPI_SOURCE_SEMANTIC_SHA256 = '4ed99e38984eb422b42477d04149301d2ba05cfa1b7af1b7e5ff5344c459d0a4';
export const M1015_EVENT_SOURCE_SEMANTIC_SHA256 = '88397f7c17eb79f73686904f69983278009ee701c9b0bea2b69e26875206cc0c';
export const M1015_B26_SOURCE_SEMANTIC_SHA256 = 'cb5b6c24a62997861956a2f5b46b7f1e20c467430ea58caa19018af9e6682a9e';
// These fingerprints are recomputed from the frozen-source projections.  They
// are intentionally checked in rather than treating the mutable current
// artifact as its own baseline.
export const M1015_OPENAPI_EXPECTED_SEMANTIC_SHA256 = '919c96cb2f907429bd51e06badf2cc9937ad8491ca91ad7672e25fc1453af105';
export const M1015_EVENT_EXPECTED_SEMANTIC_SHA256 = 'f54a7adc444e81b293e9d186df263e889bc63a69f1d40896f3d10fdf84098cca';
export const M1015_B26_EXPECTED_SEMANTIC_SHA256 = '2fcf14ccdb34c4ce40cda36793c1bfe4234fa0de2af0de8066d9d739768c5a9b';
export const M1015_POLICY_SEMANTIC_SHA256 = '388d3fc0c508428412fa669a298c9c73da3ba725e6208b6bd69e82f1e3bd62d8';
export const M1015_APPROVED_SOURCE_FILES_SEMANTIC_SHA256 = '6a3042ac3d28c98cfc51c79fa5dceb77fc5687506ed9222bb9d8daaabd17f462';
export const M1015_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256 = 'adb97bb4a37d6e8a8953368a5f3737fe3fb29c0f7f3c18393a2c31af45d8670c';
export const M1015_B26_STATIC_POLICY_SEMANTIC_SHA256 = 'a967b692a61463029d4d899d8ebe32fbad0b57d1113824be5c9ad8a9dea4387e';
export const M1015_CANONICAL_OPENAPI_SOURCE_SEMANTIC_SHA256 = '698d9d35ac27af19cbf7b52369c1d4d70bee5df2c9863fe59a32295a4df797c5';
export const M1015_CANONICAL_EVENT_SOURCE_SEMANTIC_SHA256 = '3c8740c4ad362040cf6dd97913cd9de3462a85630780caf8a38ea817c970bc25';
export const M1015_PROMOTION_ALLOWANCE_KEYS = Object.freeze([
  'id', 'sourceContractBaseline', 'previousPromotion', 'previousPromotionContract',
  'immutableGovernanceBaseline', 'runtimeStatus', 'scope', 'promotionMode',
  'allowsHistoricalV1Promotion', 'allowsDualPublish', 'approvedSourceFiles',
  'requiredCompatibilityChecks', 'b26StaticPolicy', 'canonicalOpenApiSource',
  'canonicalEventSource',
]);
export const M1015_CANONICAL_ROUTE_PROJECTIONS = Object.freeze([
  Object.freeze({ id: 'M1015-PUBLIC-CATALOG', method: 'GET', path: '/api/v1/public/commerce/catalog', operationId: 'getB13PublicCommerceCatalog' }),
  Object.freeze({ id: 'M1015-COMMERCE-READINESS', method: 'GET', path: '/api/v1/commerce/readiness', operationId: 'getB13CommerceReadiness' }),
  Object.freeze({ id: 'M1015-SKU-LIST', method: 'GET', path: '/api/v1/commerce/skus', operationId: 'listB13CommerceSkus' }),
  Object.freeze({ id: 'M1015-ENTITLEMENT-LIST', method: 'GET', path: '/api/v1/commerce/entitlements/me', operationId: 'listB13MyEntitlements' }),
  Object.freeze({ id: 'M1015-ORDER-LIST', method: 'GET', path: '/api/v1/commerce/orders', operationId: 'listB13CommerceOrders' }),
  Object.freeze({ id: 'M1015-ORDER-CREATE', method: 'POST', path: '/api/v1/commerce/orders', operationId: 'createB13CommerceOrder' }),
  Object.freeze({ id: 'M1015-PAYMENT-INTENT', method: 'POST', path: '/api/v1/commerce/orders/{orderId}/payment-intents', operationId: 'prepareB13PaymentIntent' }),
  Object.freeze({ id: 'M1015-REFUND-REQUEST', method: 'POST', path: '/api/v1/commerce/orders/{orderId}/refunds', operationId: 'requestB13OrderRefund' }),
  Object.freeze({ id: 'M1015-ACTIVATION-REDEEM', method: 'POST', path: '/api/v1/commerce/activation-codes/redeem', operationId: 'redeemB13ActivationCode' }),
  Object.freeze({ id: 'M1015-PROVIDER-CALLBACK', method: 'POST', path: '/internal/v1/commerce/providers/{provider}/callbacks', operationId: 'consumeB13PaymentProviderCallback' }),
  Object.freeze({ id: 'M1015-RECONCILIATION-REPLAY', method: 'POST', path: '/internal/v1/commerce/reconciliation/replay', operationId: 'replayB13CommerceReconciliation' }),
  Object.freeze({ id: 'M1015-ENTITLEMENT-SNAPSHOT-RESOLVE', method: 'POST', path: '/internal/v1/commerce/entitlements/{entitlementId}/snapshot', operationId: 'resolveM1015CommerceEntitlementSnapshot' }),
  Object.freeze({ id: 'M1015-ENTITLEMENT-REVOKE', method: 'POST', path: '/internal/v1/commerce/entitlements/{entitlementId}/revoke', operationId: 'revokeM1015CommerceEntitlement' }),
]);
// The two new internal commerce operations are the only approved Gateway root
// governance change in this promotion.  Keep this as a scalar projection so a
// mutable current artifact cannot smuggle unrelated boundary changes through
// the promotion by copying the whole Gateway policy object.
export const M1015_OPENAPI_GATEWAY_BASELINE_OPERATION_COUNT = Object.freeze({
  location: 'x-p1r-gateway-boundary.internalOperationPolicy.baselineOperationCount',
  from: 51,
  to: 53,
});
export const M1015_OPENAPI_PARAMETER_PROJECTIONS = Object.freeze([
  'M1015EntitlementId', 'M1015IdempotencyKey', 'M1015OrderId', 'M1015Provider',
  'M1015ProviderEnvironment', 'M1015ProviderKeyId', 'M1015ProviderNonce', 'M1015ProviderSignature',
]);
export const M1015_OPENAPI_SCHEMA_PROJECTIONS = Object.freeze([
  'M1015ActivationRedeemRequest', 'M1015Entitlement', 'M1015EntitlementInvalidation',
  'M1015EntitlementRevokeReceipt', 'M1015EntitlementRevokeRequest', 'M1015EntitlementSnapshot',
  'M1015EntitlementSnapshotResolveRequest', 'M1015EntitlementTombstone', 'M1015GracePolicy',
  'M1015Order', 'M1015OrderCreateRequest', 'M1015PaymentIntentRequest', 'M1015PaymentIntentResult',
  'M1015PaymentReadiness', 'M1015ProviderCallbackReceipt', 'M1015ProviderCallbackRequest',
  'M1015ProviderReadiness', 'M1015PublicCatalog', 'M1015PublicPlan',
  'M1015ReconciliationRecoveryReceipt', 'M1015ReconciliationReplayRequest', 'M1015Refund',
  'M1015RefundRequest', 'M1015Sku',
]);
export const M1015_OPENAPI_TAG_PROJECTIONS = Object.freeze(['M1-015-Commerce']);
export const M1015_EVENT_NAMES = Object.freeze([
  'commerce.order.created.v2',
  'commerce.payment.requested.v2',
  'commerce.payment.callback_received.v2',
  'commerce.payment.verified.v2',
  'commerce.entitlement.activated.v2',
  'commerce.entitlement.revoked.v2',
  'commerce.refund.settled.v2',
  'commerce.reconciliation.discrepancy_recorded.v2',
  'commerce.reconciliation.recovery_receipted.v2',
]);
export const M1015_EVENT_CONSUMERS = Object.freeze({
  'commerce.order.created.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' }),
  ]),
  'commerce.payment.requested.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' }),
  ]),
  'commerce.payment.callback_received.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' }),
  ]),
  'commerce.payment.verified.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' }),
  ]),
  'commerce.entitlement.activated.v2': Object.freeze([
    Object.freeze({ service: 'content-service', consumerGroup: 'cg.content-from-commerce.v1' }),
    Object.freeze({ service: 'learning-service', consumerGroup: 'cg.learning-from-commerce.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' }),
  ]),
  'commerce.entitlement.revoked.v2': Object.freeze([
    Object.freeze({ service: 'content-service', consumerGroup: 'cg.content-from-commerce.v1' }),
    Object.freeze({ service: 'learning-service', consumerGroup: 'cg.learning-from-commerce.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' }),
  ]),
  'commerce.refund.settled.v2': Object.freeze([
    Object.freeze({ service: 'content-service', consumerGroup: 'cg.content-from-commerce.v1' }),
    Object.freeze({ service: 'learning-service', consumerGroup: 'cg.learning-from-commerce.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' }),
  ]),
  'commerce.reconciliation.discrepancy_recorded.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' }),
  ]),
  'commerce.reconciliation.recovery_receipted.v2': Object.freeze([
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' }),
  ]),
});
export const M1015_EVENT_PAYLOAD_SCHEMA_PROJECTIONS = Object.freeze([
  'M1015CommerceOrderCreated', 'M1015CommercePaymentRequested', 'M1015CommercePaymentCallbackReceived',
  'M1015CommercePaymentVerified', 'M1015CommerceEntitlementActivated', 'M1015CommerceEntitlementRevoked',
  'M1015CommerceRefundSettled', 'M1015CommerceReconciliationDiscrepancyRecorded',
  'M1015CommerceReconciliationRecoveryReceipted',
]);
export const M1015_ASYNCAPI_CHANNEL_PROJECTIONS = Object.freeze(M1015_EVENT_NAMES.map((eventName) => eventName.replaceAll('.', '_')));
export const M1015_ASYNCAPI_OPERATION_PROJECTIONS = Object.freeze(M1015_EVENT_NAMES.flatMap((eventName) => {
  const channelId = eventName.replaceAll('.', '_');
  return [
    `publish_${channelId}`,
    ...(M1015_EVENT_CONSUMERS[eventName] ?? []).map(({ consumerGroup }) => `subscribe_${channelId}_${consumerGroup.replace(/[.-]/g, '_')}`),
  ];
}));
export const M1015_B26_TOPIC_PROJECTIONS = Object.freeze(['platform.commerce.v1']);
export const M1015_B26_ROUTE_PROJECTIONS = Object.freeze(M1015_EVENT_NAMES);
export const M1015_FRAGMENT_INVENTORY_ENTRY = Object.freeze({
  path: 'packages/contracts/events/v1/fragments/m1-015-commerce-v2.events.json',
  eventNames: M1015_EVENT_NAMES,
});
export const M1015_FORBIDDEN_PAYLOAD_FIELD_PATTERNS = Object.freeze([
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

export const M1011_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ["components.parameters.B9IfMatch","component parameter contract changed"],
  ["POST /api/v1/onboarding/profile.x-idempotency","operation x-idempotency contract changed"],
  ["POST /api/v1/onboarding/profile.request.description","description contract changed"],
  ["POST /api/v1/onboarding/profile.request.x-compatibility-only","unknown schema keyword or extension changed"],
  ["POST /api/v1/onboarding/profile.request.x-p1r-b9-target-mapping","unknown schema keyword or extension changed"],
  ["POST /api/v1/onboarding/profile.request.x-forbidden-client-fields","unknown schema keyword or extension changed"],
  ["POST /api/v1/onboarding/profile.request.properties.targetGoal.enum","enum contract changed from unspecified to specified"],
  ["POST /api/v1/onboarding/profile.request.properties.expectedVersion.minimum","minimum contract changed"],
  ["PATCH /api/v1/onboarding/profile.x-idempotency","operation x-idempotency contract changed"],
  ["PATCH /api/v1/onboarding/profile.request.description","description contract changed"],
  ["PATCH /api/v1/onboarding/profile.request.x-compatibility-only","unknown schema keyword or extension changed"],
  ["PATCH /api/v1/onboarding/profile.request.x-p1r-b9-target-mapping","unknown schema keyword or extension changed"],
  ["PATCH /api/v1/onboarding/profile.request.x-forbidden-client-fields","unknown schema keyword or extension changed"],
  ["PATCH /api/v1/onboarding/profile.request.properties.targetGoal.enum","enum contract changed from unspecified to specified"],
  ["PATCH /api/v1/onboarding/profile.request.properties.expectedVersion.minimum","minimum contract changed"],
  ["POST /api/v1/onboarding/goals/first.x-idempotency","operation x-idempotency contract changed"],
  ["PATCH /api/v1/learner/profile.x-idempotency","operation x-idempotency contract changed"],
  ["PATCH /api/v1/learner/profile.x-concurrency","operation x-concurrency contract changed"],
  ["PATCH /api/v1/learner/profile.responses.422","response contract added"],
  ["PATCH /api/v1/learner/profile.request.description","description contract changed"],
  ["PATCH /api/v1/learner/profile.request.not","not contract changed"],
  ["PATCH /api/v1/learner/profile.request.x-forbidden-client-fields","unknown schema keyword or extension changed"],
  ["PATCH /api/v1/learner/profile.request.x-compatibility-shadow-policy","unknown schema keyword or extension changed"],
  ["PATCH /api/v1/learner/profile.request.properties.timezone.pattern","pattern contract changed"],
  ["PATCH /api/v1/learner/profile.request.properties.targetGoal.description","description contract changed"],
  ["PATCH /api/v1/learner/profile.request.properties.targetGoal.deprecated","deprecated contract changed"],
  ["PUT /api/v1/learner/targets.x-idempotency","operation x-idempotency contract changed"],
  ["PUT /api/v1/learner/targets.x-concurrency","operation x-concurrency contract changed"],
  ["PUT /api/v1/learner/targets.request.description","description contract changed"],
  ["PUT /api/v1/learner/targets.request.x-forbidden-client-fields","unknown schema keyword or extension changed"],
  ["PUT /api/v1/learner/targets.request.properties.goalCode.enum","enum contract changed from unspecified to specified"],
  ["PUT /api/v1/learner/targets.request.properties.goalCode.pattern","pattern contract changed"],
  ["PATCH /api/v1/learner/preferences.x-idempotency","operation x-idempotency contract changed"],
  ["PATCH /api/v1/learner/preferences.x-concurrency","operation x-concurrency contract changed"],
  ["PATCH /api/v1/learner/preferences.request.description","description contract changed"],
  ["PATCH /api/v1/learner/preferences.request.x-forbidden-client-fields","unknown schema keyword or extension changed"],
  ["PATCH /api/v1/learner/preferences.request.properties.timezone.pattern","pattern contract changed"],
  ["components.schemas.B1OnboardingProfileRequest.description","description contract changed"],
  ["components.schemas.B1OnboardingProfileRequest.x-compatibility-only","unknown schema keyword or extension changed"],
  ["components.schemas.B1OnboardingProfileRequest.x-p1r-b9-target-mapping","unknown schema keyword or extension changed"],
  ["components.schemas.B1OnboardingProfileRequest.x-forbidden-client-fields","unknown schema keyword or extension changed"],
  ["components.schemas.B1OnboardingProfileRequest.properties.targetGoal.enum","enum contract changed from unspecified to specified"],
  ["components.schemas.B1OnboardingProfileRequest.properties.expectedVersion.minimum","minimum contract changed"],
  ["components.schemas.B9LearnerProfile.required","new required field: profileVersion"],
  ["components.schemas.B9LearnerProfile.x-version-policy","unknown schema keyword or extension changed"],
  ["components.schemas.B9LearnerProfile.x-planning-source-policy","unknown schema keyword or extension changed"],
  ["components.schemas.B9LearnerProfile.properties.targetGoal.description","description contract changed"],
  ["components.schemas.B9LearnerProfile.properties.targetGoal.deprecated","deprecated contract changed"],
  ["components.schemas.B9LearnerProfilePatch.description","description contract changed"],
  ["components.schemas.B9LearnerProfilePatch.not","not contract changed"],
  ["components.schemas.B9LearnerProfilePatch.x-forbidden-client-fields","unknown schema keyword or extension changed"],
  ["components.schemas.B9LearnerProfilePatch.x-compatibility-shadow-policy","unknown schema keyword or extension changed"],
  ["components.schemas.B9LearnerProfilePatch.properties.timezone.pattern","pattern contract changed"],
  ["components.schemas.B9LearnerProfilePatch.properties.targetGoal.description","description contract changed"],
  ["components.schemas.B9LearnerProfilePatch.properties.targetGoal.deprecated","deprecated contract changed"],
  ["components.schemas.B9LearnerTarget.required","new required field: targetVersion"],
  ["components.schemas.B9LearnerTarget.x-version-policy","unknown schema keyword or extension changed"],
  ["components.schemas.B9LearnerTarget.properties.goalCode.enum","enum contract changed from unspecified to specified"],
  ["components.schemas.B9LearnerTarget.properties.goalCode.pattern","pattern contract changed"],
  ["components.schemas.B9LearnerTargetUpsert.description","description contract changed"],
  ["components.schemas.B9LearnerTargetUpsert.x-forbidden-client-fields","unknown schema keyword or extension changed"],
  ["components.schemas.B9LearnerTargetUpsert.properties.goalCode.enum","enum contract changed from unspecified to specified"],
  ["components.schemas.B9LearnerTargetUpsert.properties.goalCode.pattern","pattern contract changed"],
  ["components.schemas.B9LearnerPreferences.required","new required field: weeklyStudyDays"],
  ["components.schemas.B9LearnerPreferences.required","new required field: preferenceVersion"],
  ["components.schemas.B9LearnerPreferences.x-version-policy","unknown schema keyword or extension changed"],
  ["components.schemas.B9LearnerPreferences.x-planning-source-policy","unknown schema keyword or extension changed"],
  ["components.schemas.B9LearnerPreferences.properties.timezone.pattern","pattern contract changed"],
  ["components.schemas.B9LearnerPreferencesPatch.description","description contract changed"],
  ["components.schemas.B9LearnerPreferencesPatch.x-forbidden-client-fields","unknown schema keyword or extension changed"],
  ["components.schemas.B9LearnerPreferencesPatch.properties.timezone.pattern","pattern contract changed"],
  ["components.schemas.B9FirstDayProjection","type changed from object to <unspecified>"],
  ["components.schemas.B9FirstDayProjection.required","existing required field removed: state"],
  ["components.schemas.B9FirstDayProjection.required","existing required field removed: profileReady"],
  ["components.schemas.B9FirstDayProjection.required","existing required field removed: targetReady"],
  ["components.schemas.B9FirstDayProjection.required","existing required field removed: placementStatus"],
  ["components.schemas.B9FirstDayProjection.required","existing required field removed: taskCount"],
  ["components.schemas.B9FirstDayProjection.required","existing required field removed: tasks"],
  ["components.schemas.B9FirstDayProjection.required","existing required field removed: contentEpoch"],
  ["components.schemas.B9FirstDayProjection.required","existing required field removed: projectionVersion"],
  ["components.schemas.B9FirstDayProjection.required","existing required field removed: generatedAt"],
  ["components.schemas.B9FirstDayProjection.additionalProperties","additionalProperties policy changed"],
  ["components.schemas.B9FirstDayProjection.allOf","allOf contract changed"],
  ["components.schemas.B9FirstDayProjection.x-state-policy","unknown schema keyword or extension changed"],
  ["components.schemas.B9FirstDayProjection.properties.state","existing property removed"],
  ["components.schemas.B9FirstDayProjection.properties.profileReady","existing property removed"],
  ["components.schemas.B9FirstDayProjection.properties.targetReady","existing property removed"],
  ["components.schemas.B9FirstDayProjection.properties.placementStatus","existing property removed"],
  ["components.schemas.B9FirstDayProjection.properties.taskCount","existing property removed"],
  ["components.schemas.B9FirstDayProjection.properties.tasks","existing property removed"],
  ["components.schemas.B9FirstDayProjection.properties.contentEpoch","existing property removed"],
  ["components.schemas.B9FirstDayProjection.properties.projectionVersion","existing property removed"],
  ["components.schemas.B9FirstDayProjection.properties.generatedAt","existing property removed"],
  ["components.schemas.B9FirstDayProjection.properties.degradedReason","existing property removed"],
  ["components.schemas.B9FirstDayProjection.allOf[1].oneOf[state=READY]","approved READY state branch contract changed"],
  ["components.schemas.B9FirstDayProjection.allOf[1].oneOf[state=DEGRADED]","approved DEGRADED state branch contract changed"],
  ["components.schemas.B9PlanningInputSnapshot","approved server-assembled planning-input schema added"],
]);

export const M1011_EVENT_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ["learner.target.updated.v1.compatibility","existing compatibility policy changed"],
  ["learner.target.updated.v1.x-envelope-required","new required envelope field: eventName"],
  ["learner.target.updated.v1.x-envelope-required","new required envelope field: schema"],
  ["learner.target.updated.v1.x-envelope-required","new required envelope field: version"],
  ["learner.target.updated.v1.x-envelope-required","new required envelope field: occurredAt"],
  ["learner.target.updated.v1.x-envelope-required","new required envelope field: aggregateType"],
  ["learner.target.updated.v1.x-envelope-required","new required envelope field: actorId"],
  ["learner.target.updated.v1.x-envelope-required","new required envelope field: requestId"],
  ["learner.target.updated.v1.x-envelope-required","new required envelope field: payload"],
  ["learner.target.updated.v1.payload.required","new required field: profileVersion"],
  ["learner.target.updated.v1.payload.required","new required field: preferenceVersion"],
  ["learner.target.updated.v1.payload.required","new required field: timezone"],
  ["learner.target.updated.v1.payload.required","new required field: weeklyStudyDays"],
  ["learner.target.updated.v1.payload.required","new required field: contentLocale"],
  ["learner.target.updated.v1.payload.required","new required field: goalCatalogVersion"],
  ["learner.target.updated.v1.payload.required","new required field: targetSnapshotDigest"],
  ["learner.target.updated.v1.payload.required","new required field: inputFactWatermark"],
  ["learner.target.updated.v1.payload.required","new required field: sourceEventId"],
  ["learner.target.updated.v1.payload.required","new required field: rootEventId"],
  ["learner.target.updated.v1.payload.properties.goalCode.enum","enum contract changed from unspecified to specified"],
  ["learner.target.updated.v1.payload.properties.goalCode.maxLength","maxLength contract changed"],
  ["learner.target.updated.v1.status","event governance status changed from HISTORICAL_CANDIDATE to CANONICAL_D2"],
  ["learner.first_day.projected.v1.compatibility","existing compatibility policy changed"],
  ["learner.first_day.projected.v1.payload.properties.readiness.enum","new enum value added: PROCESSING"],
  ["x-p1r-event-governance","established platform event governance changed"],
  ["asyncapi","established canonical AsyncAPI projection changed"],
]);

export const M1012_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ["GET /api/v1/assessment/placement/start.security", "existing security scheme requirement removed: B1ContentBearerAuth"],
  ["POST /api/v1/assessment/placement/start.security", "existing security scheme requirement removed: B1ContentBearerAuth"],
  ["POST /api/v1/assessment/placement/submit-step.security", "existing security scheme requirement removed: B1ContentBearerAuth"],
  ["components.schemas.B9PlanningInputSnapshot.required", "new required field: contentVersionId"],
  ["components.schemas.B9PlanningInputSnapshot.required", "new required field: placementBaseline"],
  ["components.schemas.B9PlanningInputSnapshot.description", "description contract changed"],
  ["components.schemas.B9PlanningInputSnapshot.x-source-mapping", "unknown schema keyword or extension changed"],
  ["components.schemas.B9PlanningInputSnapshot.x-forbidden-fields", "unknown schema keyword or extension changed"],
  ["components.schemas.B9PlanningInputSnapshot.x-p1r-placement-plan-saga", "unknown schema keyword or extension changed"],
  ["components.schemas.B9FirstDayProjectionCommon.x-consistency", "unknown schema keyword or extension changed"],
  ["GET /api/v1/assessment/placement/start", "approved deprecated B1 placement adapter operation changed"],
  ["POST /api/v1/assessment/placement/start", "approved deprecated B1 placement adapter operation changed"],
  ["POST /api/v1/assessment/placement/submit-step", "approved deprecated B1 placement adapter operation changed"],
  ["POST /api/v1/assessment/placement/skip", "approved deprecated B1 placement adapter operation changed"],
  ["GET /api/v1/assessment/placement/report/{sessionId}", "approved deprecated B1 placement adapter operation changed"],
  ["paths./api/v1/assessment/placement/sessions", "approved canonical B10 placement operation added"],
  ["paths./api/v1/assessment/placement/sessions/{sessionId}", "approved canonical B10 placement operation added"],
  ["paths./api/v1/assessment/placement/sessions/{sessionId}/responses", "approved canonical B10 placement operation added"],
  ["paths./api/v1/assessment/placement/baselines/skip", "approved canonical B10 placement operation added"],
  ["paths./api/v1/assessment/placement/reports/{reportId}", "approved canonical B10 placement operation added"],
  ["components.schemas.B9PlacementBaseline", "approved closed placement baseline schema added"],
  ["components.schemas.B10PlacementDigest", "approved placement schema added"],
  ["components.schemas.B10PlacementManifestDimension", "approved placement schema added"],
  ["components.schemas.B10PlacementManifest", "approved placement schema added"],
  ["components.schemas.B10PlacementManifestPin", "approved placement schema added"],
  ["components.schemas.B10PlacementContentPin", "approved placement schema added"],
  ["components.schemas.B10PlacementAnswerRulePin", "approved placement schema added"],
  ["components.schemas.B10PlacementTargetPin", "approved placement schema added"],
  ["components.schemas.B10PlacementSession", "approved placement schema added"],
  ["components.schemas.B10PlacementResponseSubmitRequest", "approved placement schema added"],
  ["components.schemas.B10PlacementDimensionSummary", "approved placement schema added"],
  ["components.schemas.B10RequestedStartingLevel", "approved placement schema added"],
  ["components.schemas.B10PlacementResult", "approved placement schema added"],
  ["components.schemas.B10PlacementResponseReceipt", "approved placement schema added"],
  ["components.schemas.B10PlacementSkipBaselineRequest", "approved placement schema added"],
  ["components.schemas.B10PlacementReport", "approved placement schema added"],
  ["components.schemas.B9PlanningInputSnapshot", "approved placement-bound planning-input schema changed"],
  ["components.schemas.B9FirstDayProjectionCommon", "approved placement baseline first-day consistency changed"],
]);

export const M1012_EVENT_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ["x-p1r-event-governance", "established platform event governance changed"],
  ["asyncapi", "established canonical AsyncAPI projection changed"],
  ["assessment.placement.completed.v1", "approved canonical placement completion event added"],
  ["payloadSchemas.B10PlacementCompleted", "approved closed placement completion payload added"],
  ["asyncapi.channels.assessment_placement_completed_v1", "approved placement completion AsyncAPI channel added"],
  ["asyncapi.operations.publish_assessment_placement_completed_v1", "approved placement completion AsyncAPI operation added"],
  ["asyncapi.operations.subscribe_assessment_placement_completed_v1_cg_learning_from_assessment_v1", "approved placement completion AsyncAPI operation added"],
  ["asyncapi.operations.subscribe_assessment_placement_completed_v1_cg_workflow_from_assessment_v1", "approved placement completion AsyncAPI operation added"],
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

function isValidM1009PromotionAllowance(allowance) {
  return isRecord(allowance)
    && allowance.id === M1009_MEDIA_PROMOTION_ID
    && allowance.sourceContractBaseline === M1009_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1008_CONTENT_PROMOTION_ID
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'OPENAPI_ONLY'
    && allowance.eventCatalogDecision === 'UNCHANGED_HISTORICAL_ONLY'
    && allowance.canonicalFragment === 'packages/contracts/fragments/b11/p1r-media.openapi.json';
}

function applyApprovedOpenApiTags(target, approved, names) {
  if (!Array.isArray(target) || !Array.isArray(approved)) return false;
  const approvedByName = new Map(approved.map((tag) => [tag?.name, tag]));
  if (approvedByName.size !== approved.length) return false;
  const nameSet = new Set(names);
  if (target.some((tag) => nameSet.has(tag?.name))) return false;
  for (const name of names) {
    const tag = approvedByName.get(name);
    if (!isRecord(tag)) return false;
    target.push(structuredClone(tag));
  }
  return true;
}

/**
 * Rebuild the sole approved M1-009 OpenAPI projection from the immutable
 * ca282 M1-008 evidence checkpoint. Additions and replacements are copied
 * only from the explicit media/IAM/Gateway allowlist; a separate semantic
 * digest then rejects any changed nested value or unlisted projection.
 */
export function buildM1009OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1009PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const projected = applyApprovedOpenApiProjection(expected.paths, approved.paths, M1009_OPENAPI_APPROVED_PATH_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected.components?.schemas, approved.components?.schemas, M1009_OPENAPI_APPROVED_SCHEMA_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected.components?.responses, approved.components?.responses, M1009_OPENAPI_APPROVED_RESPONSE_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected, approved, M1009_OPENAPI_APPROVED_ROOT_PROJECTIONS)
    && applyApprovedOpenApiTags(expected.tags, approved.tags, M1009_OPENAPI_APPROVED_TAGS);
  return projected ? expected : undefined;
}

function isValidM1010PromotionAllowance(allowance) {
  return isRecord(allowance)
    && allowance.id === M1010_ASSESSMENT_PROMOTION_ID
    && allowance.sourceContractBaseline === M1010_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1009_MEDIA_PROMOTION_ID
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'OPENAPI_AND_HISTORICAL_EVENT_PAYLOADS'
    && allowance.eventCatalogDecision === 'HISTORICAL_PAYLOADS_ONLY_NO_CANONICAL_PROMOTION'
    && allowance.canonicalFragment === 'packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json'
    && allowance.legacyAdapterFragment === 'packages/contracts/fragments/b2-assessment-mastery.openapi.json'
    && allowance.historicalEventFragment === 'packages/contracts/events/v1/fragments/b10-learning-assessment.events.json';
}

/**
 * Rebuild the only approved M1-010 OpenAPI projection from the accepted
 * 760621e M1-009 checkpoint. The allowlist limits which complete path/schema
 * nodes may change; the semantic digest below fixes every nested value.
 */
export function buildM1010OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1010PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const projected = applyApprovedOpenApiProjection(expected.paths, approved.paths, M1010_OPENAPI_APPROVED_PATH_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected.components?.schemas, approved.components?.schemas, M1010_OPENAPI_APPROVED_SCHEMA_PROJECTIONS);
  return projected ? expected : undefined;
}

function applyApprovedEventEntries(target, approved, eventNames) {
  if (!Array.isArray(target) || !Array.isArray(approved)) return false;
  const targetByName = new Map(target.map((event, index) => [event?.eventName, { event, index }]));
  const approvedByName = new Map(approved.map((event) => [event?.eventName, event]));
  if (targetByName.size !== target.length || approvedByName.size !== approved.length) return false;
  for (const eventName of eventNames) {
    const targetEntry = targetByName.get(eventName);
    const approvedEvent = approvedByName.get(eventName);
    if (!targetEntry || !isRecord(approvedEvent)) return false;
    target[targetEntry.index] = structuredClone(approvedEvent);
  }
  return true;
}

/**
 * M1-010 intentionally does not promote assessment events. It may only replace
 * the two historical event entries and their payload schemas with the frozen
 * objective-only, learner-safe projection; AsyncAPI and platform governance
 * remain byte-for-byte semantic descendants of the accepted source.
 */
export function buildM1010EventExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1010PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const projected = applyApprovedEventEntries(expected.events, approved.events, M1010_ASSESSMENT_EVENT_NAMES)
    && applyApprovedOpenApiProjection(expected.payloadSchemas, approved.payloadSchemas, M1010_EVENT_PAYLOAD_SCHEMA_PROJECTIONS);
  return projected ? expected : undefined;
}

function isValidM1011PromotionAllowance(allowance) {
  return isRecord(allowance)
    && stableGovernanceValue(Object.keys(allowance).sort()) === stableGovernanceValue([...M1011_PROMOTION_ALLOWANCE_KEYS].sort())
    && allowance.id === M1011_LEARNER_PLANNING_PROMOTION_ID
    && allowance.sourceContractBaseline === M1011_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1010_ASSESSMENT_PROMOTION_ID
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC'
    && allowance.eventCatalogDecision === 'TARGET_CANONICAL_D2_PROFILE_AND_FIRST_DAY_HISTORICAL'
    && allowance.canonicalFragment === 'packages/contracts/fragments/b9/b9-learner.openapi.json'
    && allowance.legacyAdapterFragment === 'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json'
    && allowance.historicalEventFragment === 'packages/contracts/events/v1/fragments/b9-learner-content.events.json';
}

/**
 * Rebuild the only approved M1-011 OpenAPI projection from the immutable
 * cd923 M1-010 checkpoint. The B1 compatibility adapter and B9 learner
 * planning surface are copied only at this fixed path/schema allowlist.
 */
export function buildM1011OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1011PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const projected = applyApprovedOpenApiProjection(expected.paths, approved.paths, M1011_OPENAPI_APPROVED_PATH_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected.components?.parameters, approved.components?.parameters, M1011_OPENAPI_APPROVED_PARAMETER_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected.components?.schemas, approved.components?.schemas, M1011_OPENAPI_APPROVED_SCHEMA_PROJECTIONS);
  return projected ? expected : undefined;
}

/**
 * M1-011 promotes only learner.target.updated.v1 to CANONICAL_D2. The
 * first-day payload remains historical compatibility data; its bounded schema
 * evolution and the ONB-001 governance closure are nevertheless frozen here.
 */
export function buildM1011EventExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1011PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const projected = applyApprovedEventEntries(expected.events, approved.events, M1011_LEARNER_EVENT_NAMES)
    && applyApprovedOpenApiProjection(expected.payloadSchemas, approved.payloadSchemas, M1011_EVENT_PAYLOAD_SCHEMA_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected, approved, M1011_EVENT_ROOT_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected.asyncapi?.channels, approved.asyncapi?.channels, M1011_ASYNCAPI_CHANNEL_PROJECTIONS)
    && applyApprovedOpenApiProjection(expected.asyncapi?.operations, approved.asyncapi?.operations, M1011_ASYNCAPI_OPERATION_PROJECTIONS);
  return projected ? expected : undefined;
}

function insertM1011B26Entry(target, approved, key, value) {
  if (!Array.isArray(target) || !Array.isArray(approved)) return false;
  const approvedEntries = approved.filter((entry) => entry?.[key] === value);
  if (approvedEntries.length !== 1 || target.some((entry) => entry?.[key] === value)) return false;
  const insertionIndex = approved.findIndex((entry) => entry?.[key] === value);
  if (insertionIndex < 0) return false;
  target.splice(insertionIndex, 0, structuredClone(approvedEntries[0]));
  return true;
}

/**
 * The B26 change is static-contract only: it inserts exactly the learner topic
 * and target route at their canonical positions. Its frozen digest prevents a
 * mutable runtime policy from broadening the projected values.
 */
export function buildM1011B26ExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1011PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const projected = insertM1011B26Entry(expected.topics, approved.topics, 'name', 'platform.learner.v1')
    && insertM1011B26Entry(expected.eventRouting, approved.eventRouting, 'eventName', 'learner.target.updated.v1');
  return projected ? expected : undefined;
}

function isValidM1012PromotionAllowance(allowance) {
  return isRecord(allowance)
    && stableGovernanceValue(Object.keys(allowance).sort()) === stableGovernanceValue([...M1012_PROMOTION_ALLOWANCE_KEYS].sort())
    && allowance.id === M1012_PLACEMENT_PROMOTION_ID
    && allowance.sourceContractBaseline === M1012_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1011_LEARNER_PLANNING_PROMOTION_ID
    && allowance.immutableGovernanceBaseline === M1012_IMMUTABLE_GOVERNANCE_BASELINE_REF
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC'
    && allowance.canonicalFragment === 'packages/contracts/fragments/b10/b10-placement.openapi.json'
    && stableGovernanceValue(allowance.legacyAdapterFragments) === stableGovernanceValue([
      'packages/contracts/fragments/b1/b1-onboarding-privacy.openapi.json',
      'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json',
    ])
    && allowance.planningFragment === 'packages/contracts/fragments/b9/b9-learner.openapi.json'
    && allowance.eventFragment === 'packages/contracts/events/v1/fragments/b10-learning-assessment.events.json'
    && allowance.b26StaticPolicy === 'config/b26-event-runtime.json';
}

function applyM1012OpenApiProjection(previous, expected, approved) {
  if (!isRecord(previous?.paths) || !isRecord(expected?.paths) || !isRecord(approved?.paths)
    || !isRecord(previous?.components?.schemas) || !isRecord(expected?.components?.schemas)
    || !isRecord(approved?.components?.schemas)) return false;
  if (M1012_OPENAPI_ADDED_PATH_PROJECTIONS.some((name) => Object.hasOwn(previous.paths, name))
    || M1012_OPENAPI_CHANGED_PATH_PROJECTIONS.some((name) => !Object.hasOwn(previous.paths, name))
    || M1012_OPENAPI_ADDED_SCHEMA_PROJECTIONS.some((name) => Object.hasOwn(previous.components.schemas, name))
    || M1012_OPENAPI_CHANGED_SCHEMA_PROJECTIONS.some((name) => !Object.hasOwn(previous.components.schemas, name))) return false;
  return applyApprovedOpenApiProjection(expected.paths, approved.paths, [
    ...M1012_OPENAPI_ADDED_PATH_PROJECTIONS,
    ...M1012_OPENAPI_CHANGED_PATH_PROJECTIONS,
  ]) && applyApprovedOpenApiProjection(expected.components.schemas, approved.components.schemas, [
    ...M1012_OPENAPI_ADDED_SCHEMA_PROJECTIONS,
    ...M1012_OPENAPI_CHANGED_SCHEMA_PROJECTIONS,
  ]);
}

function insertM1012ArrayEntry(target, approved, key, value) {
  if (!Array.isArray(target) || !Array.isArray(approved)) return false;
  const approvedEntries = approved.filter((entry) => entry?.[key] === value);
  if (approvedEntries.length !== 1 || target.some((entry) => entry?.[key] === value)) return false;
  const insertionIndex = approved.findIndex((entry) => entry?.[key] === value);
  if (insertionIndex < 0) return false;
  target.splice(insertionIndex, 0, structuredClone(approvedEntries[0]));
  return true;
}

function insertM1012NamedProjection(target, approved, name) {
  if (!isRecord(target) || !isRecord(approved) || Object.hasOwn(target, name) || !Object.hasOwn(approved, name)) return false;
  target[name] = structuredClone(approved[name]);
  return true;
}

/**
 * Rebuilds the sole approved M1-012 placement OpenAPI projection from the
 * immutable 270b0df M1-011 snapshot. Every changed B1/B9 path/schema and each
 * added B10 node is named above; no fragment-, tag-, or schema-family-wide
 * allowance is accepted.
 */
export function buildM1012OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1012PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  return applyM1012OpenApiProjection(previous, expected, approved) ? expected : undefined;
}

/**
 * Adds exactly one canonical placement completion fact and its generated
 * AsyncAPI projection. Envelope identity remains outside its closed payload.
 */
export function buildM1012EventExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1012PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const projected = insertM1012ArrayEntry(expected.events, approved.events, 'eventName', M1012_PLACEMENT_EVENT_NAME)
    && insertM1012NamedProjection(expected.payloadSchemas, approved.payloadSchemas, M1012_EVENT_PAYLOAD_SCHEMA)
    && applyApprovedOpenApiProjection(expected, approved, ['x-p1r-event-governance'])
    && insertM1012NamedProjection(expected.asyncapi?.channels, approved.asyncapi?.channels, M1012_ASYNCAPI_CHANNEL)
    && M1012_ASYNCAPI_OPERATIONS.every((name) => insertM1012NamedProjection(expected.asyncapi?.operations, approved.asyncapi?.operations, name));
  return projected ? expected : undefined;
}

/**
 * B26 remains static-only. M1-012 may insert the placement route into the
 * pre-existing assessment topic, but it cannot alter topics, ACLs or any
 * other route.
 */
export function buildM1012B26ExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1012PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  return insertM1012ArrayEntry(expected.eventRouting, approved.eventRouting, 'eventName', M1012_PLACEMENT_EVENT_NAME)
    ? expected
    : undefined;
}

function isValidM1013PromotionAllowance(allowance) {
  if (!isRecord(allowance)
    || stableGovernanceValue(Object.keys(allowance).sort()) !== stableGovernanceValue([...M1013_PROMOTION_ALLOWANCE_KEYS].sort())
    || allowance.id !== M1013_LEARNING_LOOP_PROMOTION_ID
    || allowance.sourceContractBaseline !== M1013_SOURCE_CONTRACT_BASELINE_REF
    || allowance.previousPromotion !== M1012_PLACEMENT_PROMOTION_ID
    || allowance.immutableGovernanceBaseline !== M1013_IMMUTABLE_GOVERNANCE_BASELINE_REF
    || allowance.runtimeStatus !== 'NOT_RUNTIME_VERIFIED'
    || allowance.scope !== 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC'
    || stableGovernanceSha256(allowance.approvedSourceFiles) !== M1013_APPROVED_SOURCE_FILES_SEMANTIC_SHA256
    || stableGovernanceValue(allowance.approvedCanonicalEvents) !== stableGovernanceValue(M1013_APPROVED_CANONICAL_EVENTS)
    || stableGovernanceSha256(allowance.canonicalRoutes) !== M1013_CANONICAL_ROUTES_SEMANTIC_SHA256
    || stableGovernanceSha256(allowance.legacyAdapters) !== M1013_LEGACY_ADAPTERS_SEMANTIC_SHA256
    || stableGovernanceSha256(allowance.historicalOnlySources) !== M1013_HISTORICAL_ONLY_SOURCES_SEMANTIC_SHA256
    || stableGovernanceSha256(allowance.prohibitedRuntimeClaims) !== M1013_PROHIBITED_RUNTIME_CLAIMS_SEMANTIC_SHA256
    || stableGovernanceValue(allowance.canonicalRoutes?.map(({ id, method, path, operationId }) => ({ id, method, path, operationId }))) !== stableGovernanceValue(M1013_CANONICAL_ROUTE_PROJECTIONS.map(({ id, method, path, operationId }) => ({ id, method, path, operationId })))
    || stableGovernanceValue(allowance.legacyAdapters?.map(({ id, method, path, operationId }) => ({ id, method, path, operationId })))
      !== stableGovernanceValue(M1013_LEGACY_ADAPTER_PROJECTIONS.map(({ id, method, path, operationId }) => ({ id, method, path, operationId })))) {
    return false;
  }
  return true;
}

function copyM1013Operation(expected, approved, projection) {
  const method = projection.method.toLowerCase();
  const approvedPath = approved?.paths?.[projection.path];
  if (!isRecord(approvedPath) || !isRecord(approvedPath[method])
    || approvedPath[method].operationId !== projection.operationId) return false;
  if (!isRecord(expected.paths)) expected.paths = {};
  if (!isRecord(expected.paths[projection.path])) expected.paths[projection.path] = {};
  expected.paths[projection.path][method] = structuredClone(approvedPath[method]);
  return true;
}

/**
 * Rebuild the only approved M1-013 OpenAPI projection from the immutable
 * M1-012 checkpoint.  Canonical learning-loop operations, their exact legacy
 * adapters, three newly introduced parameters and the affected B2/B10
 * schemas are all copied by name.  No path-wide or schema-family fallback is
 * allowed; the frozen semantic digest below pins every nested value (and in
 * particular preserves each legacy deprecation migration link).
 */
export function buildM1013OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1013PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const operationsValid = M1013_CANONICAL_ROUTE_PROJECTIONS
    .concat(M1013_LEGACY_ADAPTER_PROJECTIONS)
    .every((projection) => copyM1013Operation(expected, approved, projection));
  if (!operationsValid) return undefined;
  if (!isRecord(expected.components)) expected.components = {};
  if (!isRecord(expected.components.parameters)) expected.components.parameters = {};
  if (!isRecord(expected.components.schemas)) expected.components.schemas = {};
  for (const name of M1013_OPENAPI_APPROVED_PARAMETER_PROJECTIONS) {
    if (!isRecord(approved.components?.parameters?.[name])) return undefined;
    if (Object.hasOwn(previous.components?.parameters ?? {}, name)) return undefined;
    expected.components.parameters[name] = structuredClone(approved.components.parameters[name]);
  }
  for (const name of M1013_OPENAPI_APPROVED_SCHEMA_PROJECTIONS) {
    if (!isRecord(approved.components?.schemas?.[name])) return undefined;
    expected.components.schemas[name] = structuredClone(approved.components.schemas[name]);
  }
  return expected;
}

function insertM1013EventEntry(target, approved, eventName) {
  if (!Array.isArray(target) || !Array.isArray(approved)) return false;
  const targetEntries = target.filter((entry) => entry?.eventName === eventName);
  const approvedEntries = approved.filter((entry) => entry?.eventName === eventName);
  if (targetEntries.length !== 0 || approvedEntries.length !== 1) return false;
  const insertionIndex = approved.findIndex((entry) => entry?.eventName === eventName);
  target.splice(insertionIndex, 0, structuredClone(approvedEntries[0]));
  return true;
}

function insertM1013NamedEntry(target, approved, name) {
  if (!isRecord(target) || !isRecord(approved) || Object.hasOwn(target, name) || !isRecord(approved[name])) return false;
  target[name] = structuredClone(approved[name]);
  return true;
}

/** Rebuild the M1-013 event catalog and generated AsyncAPI projection. */
export function buildM1013EventExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1013PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  if (!isRecord(approved['x-p1r-event-governance'])) return undefined;
  expected['x-p1r-event-governance'] = structuredClone(approved['x-p1r-event-governance']);
  const eventsValid = M1013_EVENT_NAMES.every((eventName) => insertM1013EventEntry(expected.events, approved.events, eventName));
  const payloadsValid = M1013_EVENT_PAYLOAD_SCHEMA_PROJECTIONS.every((name) => insertM1013NamedEntry(expected.payloadSchemas, approved.payloadSchemas, name));
  const channelsValid = M1013_ASYNCAPI_CHANNEL_PROJECTIONS.every((name) => insertM1013NamedEntry(expected.asyncapi?.channels, approved.asyncapi?.channels, name));
  const operationsValid = M1013_ASYNCAPI_OPERATION_PROJECTIONS.every((name) => insertM1013NamedEntry(expected.asyncapi?.operations, approved.asyncapi?.operations, name));
  return eventsValid && payloadsValid && channelsValid && operationsValid ? expected : undefined;
}

/** Rebuild the three M1-013 B26 route additions without promoting runtime. */
export function buildM1013B26ExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1013PromotionAllowance(allowance)) return undefined;
  const expected = structuredClone(previous);
  const routes = Array.isArray(expected.eventRouting) && Array.isArray(approved.eventRouting)
    && M1013_EVENT_NAMES.every((eventName) => insertM1013EventEntry(expected.eventRouting, approved.eventRouting, eventName));
  return routes ? expected : undefined;
}

function compareM1013Value(changes, kind, previousValue, currentValue, location, reason) {
  if (stableGovernanceValue(previousValue) !== stableGovernanceValue(currentValue)) {
    changes.push(describeChange(kind, location, reason));
  }
}

export const M1013_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ...M1013_CANONICAL_ROUTE_PROJECTIONS.map((projection) => [
    `${projection.method} ${projection.path}`,
    'approved canonical learning-loop route projection changed',
  ]),
  ...M1013_LEGACY_ADAPTER_PROJECTIONS.map((projection) => [
    `${projection.method} ${projection.path}`,
    'approved legacy learning-loop adapter projection changed',
  ]),
  ...M1013_OPENAPI_APPROVED_PARAMETER_PROJECTIONS.map((name) => [
    `components.parameters.${name}`,
    'approved learning-loop route parameter added',
  ]),
  ...M1013_OPENAPI_APPROVED_SCHEMA_PROJECTIONS.map((name) => [
    `components.schemas.${name}`,
    'approved learning-loop schema projection changed',
  ]),
]);

export const M1013_EVENT_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ['x-p1r-event-governance', 'approved learning-loop event governance changed'],
  ...M1013_EVENT_NAMES.map((eventName) => [eventName, 'approved canonical learning-loop event added']),
  ...M1013_EVENT_PAYLOAD_SCHEMA_PROJECTIONS.map((name) => [`payloadSchemas.${name}`, 'approved learning-loop event payload added']),
  ...M1013_ASYNCAPI_CHANNEL_PROJECTIONS.map((name) => [`asyncapi.channels.${name}`, 'approved learning-loop AsyncAPI channel added']),
  ...M1013_ASYNCAPI_OPERATION_PROJECTIONS.map((name) => [`asyncapi.operations.${name}`, 'approved learning-loop AsyncAPI operation added']),
]);

export const M1013_B26_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze(
  M1013_EVENT_NAMES.map((eventName) => [`eventRouting.${eventName}`, 'approved learning-loop B26 route added']),
);

export function compareM1013OpenApiDescriptors(previous, current) {
  const changes = [];
  for (const projection of M1013_OPENAPI_ROUTE_PROJECTIONS) {
    const method = projection.method.toLowerCase();
    compareM1013Value(
      changes,
      'openapi',
      previous?.paths?.[projection.path]?.[method],
      current?.paths?.[projection.path]?.[method],
      `${projection.method} ${projection.path}`,
      projection.id.startsWith('LEGACY-')
        ? 'approved legacy learning-loop adapter projection changed'
        : 'approved canonical learning-loop route projection changed',
    );
  }
  for (const name of M1013_OPENAPI_APPROVED_PARAMETER_PROJECTIONS) {
    compareM1013Value(changes, 'openapi', previous?.components?.parameters?.[name], current?.components?.parameters?.[name], `components.parameters.${name}`, 'approved learning-loop route parameter added');
  }
  for (const name of M1013_OPENAPI_APPROVED_SCHEMA_PROJECTIONS) {
    compareM1013Value(changes, 'openapi', previous?.components?.schemas?.[name], current?.components?.schemas?.[name], `components.schemas.${name}`, 'approved learning-loop schema projection changed');
  }
  return changes;
}

export function compareM1013EventDescriptors(previous, current) {
  const changes = [];
  compareM1013Value(changes, 'events', previous?.['x-p1r-event-governance'], current?.['x-p1r-event-governance'], 'x-p1r-event-governance', 'approved learning-loop event governance changed');
  for (const eventName of M1013_EVENT_NAMES) {
    compareM1013Value(changes, 'events', (previous?.events ?? []).find((event) => event?.eventName === eventName), (current?.events ?? []).find((event) => event?.eventName === eventName), eventName, 'approved canonical learning-loop event added');
  }
  for (const name of M1013_EVENT_PAYLOAD_SCHEMA_PROJECTIONS) {
    compareM1013Value(changes, 'events', previous?.payloadSchemas?.[name], current?.payloadSchemas?.[name], `payloadSchemas.${name}`, 'approved learning-loop event payload added');
  }
  for (const name of M1013_ASYNCAPI_CHANNEL_PROJECTIONS) {
    compareM1013Value(changes, 'events', previous?.asyncapi?.channels?.[name], current?.asyncapi?.channels?.[name], `asyncapi.channels.${name}`, 'approved learning-loop AsyncAPI channel added');
  }
  for (const name of M1013_ASYNCAPI_OPERATION_PROJECTIONS) {
    compareM1013Value(changes, 'events', previous?.asyncapi?.operations?.[name], current?.asyncapi?.operations?.[name], `asyncapi.operations.${name}`, 'approved learning-loop AsyncAPI operation added');
  }
  return changes;
}

export function compareM1013B26Descriptors(previous, current) {
  const changes = [];
  for (const eventName of M1013_EVENT_NAMES) {
    compareM1013Value(changes, 'events', (previous?.eventRouting ?? []).find((entry) => entry?.eventName === eventName), (current?.eventRouting ?? []).find((entry) => entry?.eventName === eventName), `eventRouting.${eventName}`, 'approved learning-loop B26 route added');
  }
  return changes;
}

function isValidM1014PromotionAllowance(allowance) {
  const routeIdentity = Array.isArray(allowance?.canonicalRoutes)
    ? allowance.canonicalRoutes.map((route) => ({
      id: route?.id,
      method: route?.method,
      path: route?.path,
      operationId: route?.operationId,
    }))
    : undefined;
  return isRecord(allowance)
    && stableGovernanceValue(Object.keys(allowance).sort()) === stableGovernanceValue([...M1014_PROMOTION_ALLOWANCE_KEYS].sort())
    && allowance.id === M1014_GAMIFICATION_SOCIAL_PROMOTION_ID
    && allowance.sourceContractBaseline === M1014_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1013_LEARNING_LOOP_PROMOTION_ID
    && allowance.immutableGovernanceBaseline === M1014_IMMUTABLE_GOVERNANCE_BASELINE_REF
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC'
    && stableGovernanceSha256(allowance.approvedSourceFiles) === M1014_APPROVED_SOURCE_FILES_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.approvedCanonicalEvents) === M1014_APPROVED_CANONICAL_EVENTS_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.canonicalRoutes) === M1014_CANONICAL_ROUTES_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.legacyAdapters) === M1014_LEGACY_ADAPTERS_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.historicalOnlySources) === M1014_HISTORICAL_ONLY_SOURCES_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.prohibitedRuntimeClaims) === M1014_PROHIBITED_RUNTIME_CLAIMS_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.b26StaticPolicy) === M1014_B26_STATIC_POLICY_SEMANTIC_SHA256
    && stableGovernanceValue(routeIdentity) === stableGovernanceValue(M1014_CANONICAL_ROUTE_PROJECTIONS);
}

function copyM1014Operation(expected, approved, projection) {
  const method = projection.method.toLowerCase();
  const sourcePath = expected?.paths?.[projection.path];
  const approvedPath = approved?.paths?.[projection.path];
  if (!isRecord(sourcePath) || !isRecord(sourcePath[method])
    || !isRecord(approvedPath) || !isRecord(approvedPath[method])
    || approvedPath[method].operationId !== projection.operationId) return false;
  sourcePath[method] = structuredClone(approvedPath[method]);
  return true;
}

function insertM1014NamedEntry(target, approved, name) {
  if (!isRecord(target) || !isRecord(approved) || Object.hasOwn(target, name) || !isRecord(approved[name])) return false;
  target[name] = structuredClone(approved[name]);
  return true;
}

function insertM1014NamedArrayEntry(target, approved, key, name) {
  if (!Array.isArray(target) || !Array.isArray(approved)) return false;
  const targetMatches = target.filter((entry) => entry?.[key] === name);
  const approvedMatches = approved.filter((entry) => entry?.[key] === name);
  if (targetMatches.length !== 0 || approvedMatches.length !== 1) return false;
  const insertionIndex = approved.findIndex((entry) => entry?.[key] === name);
  if (insertionIndex < 0) return false;
  target.splice(insertionIndex, 0, structuredClone(approvedMatches[0]));
  return true;
}

function replaceM1014NamedArrayEntry(target, approved, key, name) {
  if (!Array.isArray(target) || !Array.isArray(approved)) return false;
  const targetIndexes = target.reduce((indexes, entry, index) => (entry?.[key] === name ? indexes.concat(index) : indexes), []);
  const approvedMatches = approved.filter((entry) => entry?.[key] === name);
  if (targetIndexes.length !== 1 || approvedMatches.length !== 1) return false;
  target[targetIndexes[0]] = structuredClone(approvedMatches[0]);
  return true;
}

function sameM1014NamedArrayEntry(previous, approved, key, name) {
  if (!Array.isArray(previous) || !Array.isArray(approved)) return false;
  const sourceMatches = previous.filter((entry) => entry?.[key] === name);
  const approvedMatches = approved.filter((entry) => entry?.[key] === name);
  return sourceMatches.length === 1
    && approvedMatches.length === 1
    && stableGovernanceValue(sourceMatches[0]) === stableGovernanceValue(approvedMatches[0]);
}

function insertM1014Tag(target, approved, name) {
  if (!Array.isArray(target?.tags) || !Array.isArray(approved?.tags)) return false;
  return insertM1014NamedArrayEntry(target.tags, approved.tags, 'name', name);
}

/**
 * Rebuilds the sole approved M1-014 OpenAPI state from the immutable e351
 * M1-013 projection.  Every promotion is a named operation replacement;
 * only its listed component parameters, schemas and two tags are inserted.
 * No B4/B12 path object, component family or fragment is copied wholesale.
 */
export function buildM1014OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1014PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1014_OPENAPI_SOURCE_SEMANTIC_SHA256
    || !isRecord(previous.paths) || !isRecord(previous.components?.parameters) || !isRecord(previous.components?.schemas)
    || !isRecord(approved.components?.parameters) || !isRecord(approved.components?.schemas)) return undefined;
  if (M1014_OPENAPI_PROHIBITED_PARAMETER_ALIASES.some((name) => Object.hasOwn(previous.components.parameters, name)
    || Object.hasOwn(approved.components.parameters, name))) return undefined;
  const expected = structuredClone(previous);
  if (!M1014_CANONICAL_ROUTE_PROJECTIONS.every((projection) => copyM1014Operation(expected, approved, projection))) return undefined;
  if (!M1014_OPENAPI_TAG_PROJECTIONS.every((name) => insertM1014Tag(expected, approved, name))) return undefined;
  for (const name of M1014_OPENAPI_PARAMETER_PROJECTIONS) {
    if (Object.hasOwn(previous.components.parameters, name)
      || !insertM1014NamedEntry(expected.components.parameters, approved.components.parameters, name)) return undefined;
  }
  for (const name of M1014_OPENAPI_SCHEMA_PROJECTIONS) {
    if (Object.hasOwn(previous.components.schemas, name)
      || !insertM1014NamedEntry(expected.components.schemas, approved.components.schemas, name)) return undefined;
  }
  return expected;
}

/**
 * Rebuilds the exact M1-014 event catalog and generated AsyncAPI projection.
 * The two predecessor events only gain their allowlisted gamification
 * consumers.  The review-scheduled event is intentionally copied from e351
 * unchanged, so a gamification binding or any other review drift fails before
 * a candidate projection can be constructed.
 */
export function buildM1014EventExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1014PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1014_EVENT_SOURCE_SEMANTIC_SHA256
    || !isRecord(approved['x-p1r-event-governance'])
    || !sameM1014NamedArrayEntry(previous.events, approved.events, 'eventName', 'learning.review.scheduled.v2')) return undefined;
  const expected = structuredClone(previous);
  expected['x-p1r-event-governance'] = structuredClone(approved['x-p1r-event-governance']);
  const eventProjection = M1014_REPLACED_EVENT_NAMES.every((name) => replaceM1014NamedArrayEntry(expected.events, approved.events, 'eventName', name))
    && M1014_NEW_EVENT_NAMES.every((name) => insertM1014NamedArrayEntry(expected.events, approved.events, 'eventName', name));
  const payloadProjection = M1014_EVENT_PAYLOAD_SCHEMA_PROJECTIONS.every((name) => insertM1014NamedEntry(expected.payloadSchemas, approved.payloadSchemas, name));
  const channelProjection = M1014_ASYNCAPI_CHANNEL_PROJECTIONS.every((name) => insertM1014NamedEntry(expected.asyncapi?.channels, approved.asyncapi?.channels, name));
  const operationProjection = M1014_ASYNCAPI_OPERATION_PROJECTIONS.every((name) => insertM1014NamedEntry(expected.asyncapi?.operations, approved.asyncapi?.operations, name));
  return eventProjection && payloadProjection && channelProjection && operationProjection ? expected : undefined;
}

/**
 * B26 remains an explicitly static, pending/NO-GO governance document.  The
 * promotion may replace only the assessment and learning consumer ACL nodes,
 * add two topics, and add eight named routes; review scheduling remains
 * unchanged and cannot acquire a gamification consumer.
 */
export function buildM1014B26ExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1014PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1014_B26_SOURCE_SEMANTIC_SHA256
    || !sameM1014NamedArrayEntry(previous.eventRouting, approved.eventRouting, 'eventName', 'learning.review.scheduled.v2')) return undefined;
  const expected = structuredClone(previous);
  const topics = M1014_B26_REPLACED_TOPIC_PROJECTIONS.every((name) => replaceM1014NamedArrayEntry(expected.topics, approved.topics, 'name', name))
    && M1014_B26_ADDED_TOPIC_PROJECTIONS.every((name) => insertM1014NamedArrayEntry(expected.topics, approved.topics, 'name', name));
  const routes = M1014_REPLACED_EVENT_NAMES.every((name) => replaceM1014NamedArrayEntry(expected.eventRouting, approved.eventRouting, 'eventName', name))
    && M1014_NEW_EVENT_NAMES.every((name) => insertM1014NamedArrayEntry(expected.eventRouting, approved.eventRouting, 'eventName', name));
  return topics && routes ? expected : undefined;
}

function compareM1014Value(changes, kind, previousValue, currentValue, location, reason) {
  if (stableGovernanceValue(previousValue) !== stableGovernanceValue(currentValue)) {
    changes.push(describeChange(kind, location, reason));
  }
}

export const M1014_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ...M1014_CANONICAL_ROUTE_PROJECTIONS.map((projection) => [
    `${projection.method} ${projection.path}`,
    'approved canonical M1-014 gamification/social operation changed',
  ]),
  ...M1014_OPENAPI_TAG_PROJECTIONS.map((name) => [`tags.${name}`, 'approved M1-014 API tag added']),
  ...M1014_OPENAPI_PARAMETER_PROJECTIONS.map((name) => [`components.parameters.${name}`, 'approved M1-014 component parameter added']),
  ...M1014_OPENAPI_SCHEMA_PROJECTIONS.map((name) => [`components.schemas.${name}`, 'approved M1-014 component schema added']),
]);

export const M1014_EVENT_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ['x-p1r-event-governance', 'approved M1-014 event governance changed'],
  ...M1014_REPLACED_EVENT_NAMES.map((name) => [name, 'approved canonical event consumer governance changed']),
  ...M1014_NEW_EVENT_NAMES.map((name) => [name, 'approved canonical M1-014 event added']),
  ...M1014_EVENT_PAYLOAD_SCHEMA_PROJECTIONS.map((name) => [`payloadSchemas.${name}`, 'approved M1-014 event payload added']),
  ...M1014_ASYNCAPI_CHANNEL_PROJECTIONS.map((name) => [`asyncapi.channels.${name}`, 'approved M1-014 AsyncAPI channel added']),
  ...M1014_ASYNCAPI_OPERATION_PROJECTIONS.map((name) => [`asyncapi.operations.${name}`, 'approved M1-014 AsyncAPI operation added']),
]);

export const M1014_B26_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ...M1014_B26_REPLACED_TOPIC_PROJECTIONS.map((name) => [`topics.${name}`, 'approved M1-014 B26 consumer ACL changed']),
  ...M1014_B26_ADDED_TOPIC_PROJECTIONS.map((name) => [`topics.${name}`, 'approved M1-014 B26 topic added']),
  ...M1014_REPLACED_EVENT_NAMES.map((name) => [`eventRouting.${name}`, 'approved M1-014 B26 consumer route changed']),
  ...M1014_NEW_EVENT_NAMES.map((name) => [`eventRouting.${name}`, 'approved M1-014 B26 route added']),
]);

export function compareM1014OpenApiDescriptors(previous, current) {
  const changes = [];
  for (const projection of M1014_CANONICAL_ROUTE_PROJECTIONS) {
    const method = projection.method.toLowerCase();
    compareM1014Value(changes, 'openapi', previous?.paths?.[projection.path]?.[method], current?.paths?.[projection.path]?.[method], `${projection.method} ${projection.path}`, 'approved canonical M1-014 gamification/social operation changed');
  }
  for (const name of M1014_OPENAPI_TAG_PROJECTIONS) {
    compareM1014Value(changes, 'openapi', (previous?.tags ?? []).find((tag) => tag?.name === name), (current?.tags ?? []).find((tag) => tag?.name === name), `tags.${name}`, 'approved M1-014 API tag added');
  }
  for (const name of M1014_OPENAPI_PARAMETER_PROJECTIONS) {
    compareM1014Value(changes, 'openapi', previous?.components?.parameters?.[name], current?.components?.parameters?.[name], `components.parameters.${name}`, 'approved M1-014 component parameter added');
  }
  for (const name of M1014_OPENAPI_SCHEMA_PROJECTIONS) {
    compareM1014Value(changes, 'openapi', previous?.components?.schemas?.[name], current?.components?.schemas?.[name], `components.schemas.${name}`, 'approved M1-014 component schema added');
  }
  return changes;
}

export function compareM1014EventDescriptors(previous, current) {
  const changes = [];
  compareM1014Value(changes, 'events', previous?.['x-p1r-event-governance'], current?.['x-p1r-event-governance'], 'x-p1r-event-governance', 'approved M1-014 event governance changed');
  for (const name of M1014_REPLACED_EVENT_NAMES) {
    compareM1014Value(changes, 'events', (previous?.events ?? []).find((event) => event?.eventName === name), (current?.events ?? []).find((event) => event?.eventName === name), name, 'approved canonical event consumer governance changed');
  }
  for (const name of M1014_NEW_EVENT_NAMES) {
    compareM1014Value(changes, 'events', (previous?.events ?? []).find((event) => event?.eventName === name), (current?.events ?? []).find((event) => event?.eventName === name), name, 'approved canonical M1-014 event added');
  }
  for (const name of M1014_EVENT_PAYLOAD_SCHEMA_PROJECTIONS) {
    compareM1014Value(changes, 'events', previous?.payloadSchemas?.[name], current?.payloadSchemas?.[name], `payloadSchemas.${name}`, 'approved M1-014 event payload added');
  }
  for (const name of M1014_ASYNCAPI_CHANNEL_PROJECTIONS) {
    compareM1014Value(changes, 'events', previous?.asyncapi?.channels?.[name], current?.asyncapi?.channels?.[name], `asyncapi.channels.${name}`, 'approved M1-014 AsyncAPI channel added');
  }
  for (const name of M1014_ASYNCAPI_OPERATION_PROJECTIONS) {
    compareM1014Value(changes, 'events', previous?.asyncapi?.operations?.[name], current?.asyncapi?.operations?.[name], `asyncapi.operations.${name}`, 'approved M1-014 AsyncAPI operation added');
  }
  return changes;
}

export function compareM1014B26Descriptors(previous, current) {
  const changes = [];
  for (const name of M1014_B26_REPLACED_TOPIC_PROJECTIONS) {
    compareM1014Value(changes, 'events', (previous?.topics ?? []).find((topic) => topic?.name === name), (current?.topics ?? []).find((topic) => topic?.name === name), `topics.${name}`, 'approved M1-014 B26 consumer ACL changed');
  }
  for (const name of M1014_B26_ADDED_TOPIC_PROJECTIONS) {
    compareM1014Value(changes, 'events', (previous?.topics ?? []).find((topic) => topic?.name === name), (current?.topics ?? []).find((topic) => topic?.name === name), `topics.${name}`, 'approved M1-014 B26 topic added');
  }
  for (const name of M1014_REPLACED_EVENT_NAMES) {
    compareM1014Value(changes, 'events', (previous?.eventRouting ?? []).find((entry) => entry?.eventName === name), (current?.eventRouting ?? []).find((entry) => entry?.eventName === name), `eventRouting.${name}`, 'approved M1-014 B26 consumer route changed');
  }
  for (const name of M1014_NEW_EVENT_NAMES) {
    compareM1014Value(changes, 'events', (previous?.eventRouting ?? []).find((entry) => entry?.eventName === name), (current?.eventRouting ?? []).find((entry) => entry?.eventName === name), `eventRouting.${name}`, 'approved M1-014 B26 route added');
  }
  return changes;
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

function compareM1009OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1009PromotionAllowance(allowance)) {
    return [describeChange(
      'openapi',
      'm1-009.openapiPromotion',
      'M1-009 promotion allowance cannot be applied without the frozen media policy allowance',
    )];
  }

  const changes = [];
  if (stableGovernanceSha256(previous) !== M1009_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange(
      'openapi',
      'm1-009.openapiPromotion.source',
      'M1-009 OpenAPI promotion source is not the frozen ca282 M1-008 evidence projection',
    ));
  }

  const expectedDescriptors = M1009_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS
    .map(([location, reason]) => describeChange('openapi', location, reason))
    .sort(function (left, right) { return stableGovernanceValue(left).localeCompare(stableGovernanceValue(right)); });
  const actualDescriptors = compareOpenApi(previous, current)
    .sort(function (left, right) { return stableGovernanceValue(left).localeCompare(stableGovernanceValue(right)); });
  if (stableGovernanceValue(actualDescriptors) !== stableGovernanceValue(expectedDescriptors)) {
    changes.push(describeChange(
      'openapi',
      'm1-009.openapiPromotion.change-descriptors',
      'current OpenAPI changes do not exactly match the frozen M1-009 descriptor set',
    ));
  }

  const expectedProjection = buildM1009OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange(
      'openapi',
      'm1-009.openapiPromotion.projection',
      'the approved media/IAM/Gateway projection cannot be constructed from the frozen source',
    ));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1009_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange(
        'openapi',
        'm1-009.openapiPromotion.expected-projection',
        'the allowlisted M1-009 projection does not match its frozen semantic digest',
      ));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange(
        'openapi',
        'm1-009.openapiPromotion.projection',
        'current OpenAPI is not the unique frozen-source media/IAM/Gateway projection',
      ));
    }
  }
  return changes;
}

function compareM1011FirstDayStateBranch(document, state) {
  const branches = document?.components?.schemas?.B9FirstDayProjection?.allOf?.[1]?.oneOf;
  if (!Array.isArray(branches)) return undefined;
  return branches.find((branch) => branch?.properties?.state?.const === state);
}

export function compareM1011OpenApiDescriptors(previous, current) {
  const changes = compareOpenApi(previous, current);
  const compareValue = (previousValue, currentValue, location, reason) => {
    if (stableGovernanceValue(previousValue) !== stableGovernanceValue(currentValue)) {
      changes.push(describeChange('openapi', location, reason));
    }
  };
  compareValue(
    previous?.components?.parameters?.B9IfMatch,
    current?.components?.parameters?.B9IfMatch,
    'components.parameters.B9IfMatch',
    'component parameter contract changed',
  );
  for (const [method, path] of [
    ['PATCH', '/api/v1/learner/profile'],
    ['PUT', '/api/v1/learner/targets'],
    ['PATCH', '/api/v1/learner/preferences'],
  ]) {
    const methodKey = method.toLowerCase();
    compareValue(
      previous?.paths?.[path]?.[methodKey]?.['x-concurrency'],
      current?.paths?.[path]?.[methodKey]?.['x-concurrency'],
      `${method} ${path}.x-concurrency`,
      'operation x-concurrency contract changed',
    );
  }
  compareValue(
    previous?.paths?.['/api/v1/learner/profile']?.patch?.responses?.['422'],
    current?.paths?.['/api/v1/learner/profile']?.patch?.responses?.['422'],
    'PATCH /api/v1/learner/profile.responses.422',
    'response contract added',
  );
  compareValue(
    previous?.components?.schemas?.B9PlanningInputSnapshot,
    current?.components?.schemas?.B9PlanningInputSnapshot,
    'components.schemas.B9PlanningInputSnapshot',
    'approved server-assembled planning-input schema added',
  );
  for (const state of ['READY', 'DEGRADED']) {
    compareValue(
      compareM1011FirstDayStateBranch(previous, state),
      compareM1011FirstDayStateBranch(current, state),
      `components.schemas.B9FirstDayProjection.allOf[1].oneOf[state=${state}]`,
      `approved ${state} state branch contract changed`,
    );
  }
  return changes;
}

function compareM1012Value(changes, kind, previousValue, currentValue, location, reason) {
  if (stableGovernanceValue(previousValue) !== stableGovernanceValue(currentValue)) {
    changes.push(describeChange(kind, location, reason));
  }
}

/**
 * Emits the generic backwards-compatibility differences plus a named
 * descriptor for every exact M1-012 projection node.  The whole-node
 * descriptors are deliberately finite: semantic changes are additionally
 * pinned by the rebuilt projection digest below, rather than allowing a B1,
 * B9 or B10 family wholesale.
 */
export function compareM1012OpenApiDescriptors(previous, current) {
  const changes = compareOpenApi(previous, current);
  for (const [method, route] of [
    ['GET', '/api/v1/assessment/placement/start'],
    ['POST', '/api/v1/assessment/placement/start'],
    ['POST', '/api/v1/assessment/placement/submit-step'],
    ['POST', '/api/v1/assessment/placement/skip'],
    ['GET', '/api/v1/assessment/placement/report/{sessionId}'],
  ]) {
    compareM1012Value(
      changes,
      'openapi',
      previous?.paths?.[route]?.[method.toLowerCase()],
      current?.paths?.[route]?.[method.toLowerCase()],
      `${method} ${route}`,
      'approved deprecated B1 placement adapter operation changed',
    );
  }
  for (const route of M1012_OPENAPI_ADDED_PATH_PROJECTIONS) {
    compareM1012Value(
      changes,
      'openapi',
      previous?.paths?.[route],
      current?.paths?.[route],
      `paths.${route}`,
      'approved canonical B10 placement operation added',
    );
  }
  for (const schemaName of M1012_OPENAPI_ADDED_SCHEMA_PROJECTIONS) {
    compareM1012Value(
      changes,
      'openapi',
      previous?.components?.schemas?.[schemaName],
      current?.components?.schemas?.[schemaName],
      `components.schemas.${schemaName}`,
      schemaName === 'B9PlacementBaseline'
        ? 'approved closed placement baseline schema added'
        : 'approved placement schema added',
    );
  }
  compareM1012Value(
    changes,
    'openapi',
    previous?.components?.schemas?.B9PlanningInputSnapshot,
    current?.components?.schemas?.B9PlanningInputSnapshot,
    'components.schemas.B9PlanningInputSnapshot',
    'approved placement-bound planning-input schema changed',
  );
  compareM1012Value(
    changes,
    'openapi',
    previous?.components?.schemas?.B9FirstDayProjectionCommon,
    current?.components?.schemas?.B9FirstDayProjectionCommon,
    'components.schemas.B9FirstDayProjectionCommon',
    'approved placement baseline first-day consistency changed',
  );
  return changes;
}

export function compareM1012EventDescriptors(previous, current) {
  const changes = compareEvents(previous, current);
  compareM1012Value(
    changes,
    'events',
    (previous?.events ?? []).find((event) => event?.eventName === M1012_PLACEMENT_EVENT_NAME),
    (current?.events ?? []).find((event) => event?.eventName === M1012_PLACEMENT_EVENT_NAME),
    M1012_PLACEMENT_EVENT_NAME,
    'approved canonical placement completion event added',
  );
  compareM1012Value(
    changes,
    'events',
    previous?.payloadSchemas?.[M1012_EVENT_PAYLOAD_SCHEMA],
    current?.payloadSchemas?.[M1012_EVENT_PAYLOAD_SCHEMA],
    `payloadSchemas.${M1012_EVENT_PAYLOAD_SCHEMA}`,
    'approved closed placement completion payload added',
  );
  compareM1012Value(
    changes,
    'events',
    previous?.asyncapi?.channels?.[M1012_ASYNCAPI_CHANNEL],
    current?.asyncapi?.channels?.[M1012_ASYNCAPI_CHANNEL],
    `asyncapi.channels.${M1012_ASYNCAPI_CHANNEL}`,
    'approved placement completion AsyncAPI channel added',
  );
  for (const operationName of M1012_ASYNCAPI_OPERATIONS) {
    compareM1012Value(
      changes,
      'events',
      previous?.asyncapi?.operations?.[operationName],
      current?.asyncapi?.operations?.[operationName],
      `asyncapi.operations.${operationName}`,
      'approved placement completion AsyncAPI operation added',
    );
  }
  return changes;
}

function compareFrozenDescriptorSet(kind, previous, current, expected, location, message, compare = undefined) {
  const comparator = compare ?? (kind === 'openapi' ? compareOpenApi : compareEvents);
  const actual = comparator(previous, current)
    .sort(function (left, right) { return stableGovernanceValue(left).localeCompare(stableGovernanceValue(right)); });
  const frozen = expected
    .map(([entryLocation, reason]) => describeChange(kind, entryLocation, reason))
    .sort(function (left, right) { return stableGovernanceValue(left).localeCompare(stableGovernanceValue(right)); });
  return stableGovernanceValue(actual) === stableGovernanceValue(frozen)
    ? []
    : [describeChange(kind, location, message)];
}

function compareM1010OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1010PromotionAllowance(allowance)) {
    return [describeChange('openapi', 'm1-010.openapiPromotion', 'M1-010 promotion allowance cannot be applied without the frozen assessment policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1010_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm1-010.openapiPromotion.source', 'M1-010 OpenAPI promotion source is not the frozen 760621e M1-009 evidence projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'openapi',
    previous,
    current,
    M1010_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-010.openapiPromotion.change-descriptors',
    'current OpenAPI changes do not exactly match the frozen M1-010 descriptor set',
  ));
  const expectedProjection = buildM1010OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('openapi', 'm1-010.openapiPromotion.projection', 'the approved B2/B10 assessment projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1010_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('openapi', 'm1-010.openapiPromotion.expected-projection', 'the allowlisted M1-010 OpenAPI projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('openapi', 'm1-010.openapiPromotion.projection', 'current OpenAPI is not the unique frozen-source assessment projection'));
    }
  }
  return changes;
}

function compareM1010EventPromotion(previous, current, allowance) {
  if (!isValidM1010PromotionAllowance(allowance)) {
    return [describeChange('events', 'm1-010.eventPromotion', 'M1-010 event allowance cannot be applied without the frozen assessment policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1010_EVENT_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'm1-010.eventPromotion.source', 'M1-010 event source is not the frozen 760621e M1-009 evidence projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'events',
    previous,
    current,
    M1010_EVENT_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-010.eventPromotion.change-descriptors',
    'current event changes do not exactly match the frozen M1-010 descriptor set',
  ));
  const expectedProjection = buildM1010EventExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'm1-010.eventPromotion.projection', 'the approved historical assessment-event projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1010_EVENT_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'm1-010.eventPromotion.expected-projection', 'the allowlisted M1-010 event projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('events', 'm1-010.eventPromotion.projection', 'current event catalog is not the unique frozen-source historical payload projection'));
    }
  }
  return changes;
}

function compareM1011OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1011PromotionAllowance(allowance)) {
    return [describeChange('openapi', 'm1-011.openapiPromotion', 'M1-011 promotion allowance cannot be applied without the frozen learner-planning policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1011_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm1-011.openapiPromotion.source', 'M1-011 OpenAPI promotion source is not the frozen cd923 M1-010 evidence projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'openapi',
    previous,
    current,
    M1011_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-011.openapiPromotion.change-descriptors',
    'current OpenAPI changes do not exactly match the frozen M1-011 descriptor set',
    compareM1011OpenApiDescriptors,
  ));
  const expectedProjection = buildM1011OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('openapi', 'm1-011.openapiPromotion.projection', 'the approved B1/B9 learner-planning projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1011_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('openapi', 'm1-011.openapiPromotion.expected-projection', 'the allowlisted M1-011 OpenAPI projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('openapi', 'm1-011.openapiPromotion.projection', 'current OpenAPI is not the unique frozen-source learner-planning projection'));
    }
  }
  return changes;
}

function compareM1011EventPromotion(previous, current, allowance) {
  if (!isValidM1011PromotionAllowance(allowance)) {
    return [describeChange('events', 'm1-011.eventPromotion', 'M1-011 event allowance cannot be applied without the frozen learner-planning policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1011_EVENT_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'm1-011.eventPromotion.source', 'M1-011 event source is not the frozen cd923 M1-010 evidence projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'events',
    previous,
    current,
    M1011_EVENT_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-011.eventPromotion.change-descriptors',
    'current event changes do not exactly match the frozen M1-011 descriptor set',
  ));
  const expectedProjection = buildM1011EventExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'm1-011.eventPromotion.projection', 'the approved learner canonical-event and historical first-day projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1011_EVENT_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'm1-011.eventPromotion.expected-projection', 'the allowlisted M1-011 event projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('events', 'm1-011.eventPromotion.projection', 'current event catalog is not the unique frozen-source learner canonical-event projection'));
    }
  }
  return changes;
}

function compareM1011B26Promotion(previous, current, allowance) {
  if (!isValidM1011PromotionAllowance(allowance)) {
    return [describeChange('events', 'b26.m1-011.compatibilityPromotion', 'M1-011 B26 allowance cannot be applied without the frozen learner-planning policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1011_B26_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'b26.m1-011.source', 'M1-011 B26 promotion source is not the frozen cd923 M1-010 evidence projection'));
  }
  const expectedProjection = buildM1011B26ExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'b26.m1-011.projection', 'the approved platform.learner.v1 topic and target route cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1011_B26_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'b26.m1-011.expected-projection', 'the allowlisted M1-011 B26 projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(...compareB26WorkflowGovernance(expectedProjection, current));
      changes.push(describeChange('events', 'b26.m1-011.projection', 'current B26 runtime policy differs from the explicit static M1-011 learner-topic promotion'));
    }
  }
  return changes;
}

function compareM1012OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1012PromotionAllowance(allowance)) {
    return [describeChange('openapi', 'm1-012.openapiPromotion', 'M1-012 promotion allowance cannot be applied without the frozen placement policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1012_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm1-012.openapiPromotion.source', 'M1-012 OpenAPI promotion source is not the frozen 270b0df M1-011 evidence projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'openapi',
    previous,
    current,
    M1012_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-012.openapiPromotion.change-descriptors',
    'current OpenAPI changes do not exactly match the frozen M1-012 descriptor set',
    compareM1012OpenApiDescriptors,
  ));
  const expectedProjection = buildM1012OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('openapi', 'm1-012.openapiPromotion.projection', 'the approved B10 placement, B1 adapter and B9 placement-binding projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1012_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('openapi', 'm1-012.openapiPromotion.expected-projection', 'the allowlisted M1-012 OpenAPI projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('openapi', 'm1-012.openapiPromotion.projection', 'current OpenAPI is not the unique frozen-source placement projection'));
    }
  }
  return changes;
}

function compareM1012EventPromotion(previous, current, allowance) {
  if (!isValidM1012PromotionAllowance(allowance)) {
    return [describeChange('events', 'm1-012.eventPromotion', 'M1-012 event allowance cannot be applied without the frozen placement policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1012_EVENT_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'm1-012.eventPromotion.source', 'M1-012 event promotion source is not the frozen 270b0df M1-011 evidence projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'events',
    previous,
    current,
    M1012_EVENT_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-012.eventPromotion.change-descriptors',
    'current event changes do not exactly match the frozen M1-012 descriptor set',
    compareM1012EventDescriptors,
  ));
  const expectedProjection = buildM1012EventExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'm1-012.eventPromotion.projection', 'the approved canonical placement-completion event projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1012_EVENT_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'm1-012.eventPromotion.expected-projection', 'the allowlisted M1-012 event projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('events', 'm1-012.eventPromotion.projection', 'current event catalog is not the unique frozen-source placement-completion projection'));
    }
  }
  return changes;
}

function compareM1012B26Promotion(previous, current, allowance) {
  if (!isValidM1012PromotionAllowance(allowance)) {
    return [describeChange('events', 'b26.m1-012.compatibilityPromotion', 'M1-012 B26 allowance cannot be applied without the frozen placement policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1012_B26_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'b26.m1-012.source', 'M1-012 B26 promotion source is not the frozen 270b0df M1-011 evidence projection'));
  }
  const expectedProjection = buildM1012B26ExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'b26.m1-012.projection', 'the approved platform.assessment.v1 placement route cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1012_B26_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'b26.m1-012.expected-projection', 'the allowlisted M1-012 B26 projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(...compareB26WorkflowGovernance(expectedProjection, current));
      changes.push(describeChange('events', 'b26.m1-012.projection', 'current B26 runtime policy differs from the explicit static M1-012 placement-route promotion'));
    }
  }
  return changes;
}

function compareM1013OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1013PromotionAllowance(allowance)) {
    return [describeChange('openapi', 'm1-013.openapiPromotion', 'M1-013 promotion allowance cannot be applied without the frozen learning-loop policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1013_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm1-013.openapiPromotion.source', 'M1-013 OpenAPI promotion source is not the frozen a07a58a M1-012 projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'openapi',
    previous,
    current,
    M1013_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-013.openapiPromotion.change-descriptors',
    'current OpenAPI changes do not exactly match the frozen M1-013 descriptor set',
    compareM1013OpenApiDescriptors,
  ));
  const expectedProjection = buildM1013OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('openapi', 'm1-013.openapiPromotion.projection', 'the approved canonical and legacy learning-loop projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1013_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('openapi', 'm1-013.openapiPromotion.expected-projection', 'the allowlisted M1-013 OpenAPI projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('openapi', 'm1-013.openapiPromotion.projection', 'current OpenAPI is not the unique frozen-source learning-loop projection'));
    }
  }
  return changes;
}

function compareM1013EventPromotion(previous, current, allowance) {
  if (!isValidM1013PromotionAllowance(allowance)) {
    return [describeChange('events', 'm1-013.eventPromotion', 'M1-013 event allowance cannot be applied without the frozen learning-loop policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1013_EVENT_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'm1-013.eventPromotion.source', 'M1-013 event source is not the frozen a07a58a M1-012 projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'events',
    previous,
    current,
    M1013_EVENT_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-013.eventPromotion.change-descriptors',
    'current event changes do not exactly match the frozen M1-013 descriptor set',
    compareM1013EventDescriptors,
  ));
  const expectedProjection = buildM1013EventExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'm1-013.eventPromotion.projection', 'the approved canonical learning-loop event projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1013_EVENT_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'm1-013.eventPromotion.expected-projection', 'the allowlisted M1-013 event projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('events', 'm1-013.eventPromotion.projection', 'current event catalog is not the unique frozen-source learning-loop projection'));
    }
  }
  return changes;
}

function compareM1013B26Promotion(previous, current, allowance) {
  if (!isValidM1013PromotionAllowance(allowance)) {
    return [describeChange('events', 'b26.m1-013.compatibilityPromotion', 'M1-013 B26 allowance cannot be applied without the frozen learning-loop policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1013_B26_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'b26.m1-013.source', 'M1-013 B26 promotion source is not the frozen a07a58a M1-012 projection'));
  }
  const expectedProjection = buildM1013B26ExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'b26.m1-013.projection', 'the approved learning-loop B26 routes cannot be constructed from the frozen source'));
  } else {
    changes.push(...compareFrozenDescriptorSet(
      'events',
      previous,
      current,
      M1013_B26_EXPECTED_CHANGE_DESCRIPTORS,
      'b26.m1-013.change-descriptors',
      'current B26 changes do not exactly match the frozen M1-013 descriptor set',
      compareM1013B26Descriptors,
    ));
    if (stableGovernanceSha256(expectedProjection) !== M1013_B26_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'b26.m1-013.expected-projection', 'the allowlisted M1-013 B26 projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('events', 'b26.m1-013.projection', 'current B26 runtime policy differs from the explicit static M1-013 learning-loop route promotion'));
    }
  }
  return changes;
}

function compareM1014OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1014PromotionAllowance(allowance)) {
    return [describeChange('openapi', 'm1-014.openapiPromotion', 'M1-014 promotion allowance cannot be applied without the frozen gamification/social policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1014_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm1-014.openapiPromotion.source', 'M1-014 OpenAPI promotion source is not the frozen e351 M1-013 projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'openapi',
    previous,
    current,
    M1014_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-014.openapiPromotion.change-descriptors',
    'current OpenAPI changes do not exactly match the frozen M1-014 descriptor set',
    compareM1014OpenApiDescriptors,
  ));
  const expectedProjection = buildM1014OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('openapi', 'm1-014.openapiPromotion.projection', 'the approved canonical gamification/social OpenAPI projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1014_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('openapi', 'm1-014.openapiPromotion.expected-projection', 'the allowlisted M1-014 OpenAPI projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('openapi', 'm1-014.openapiPromotion.projection', 'current OpenAPI is not the unique frozen-source M1-014 projection'));
    }
  }
  return changes;
}

function compareM1014EventPromotion(previous, current, allowance) {
  if (!isValidM1014PromotionAllowance(allowance)) {
    return [describeChange('events', 'm1-014.eventPromotion', 'M1-014 event allowance cannot be applied without the frozen gamification/social policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1014_EVENT_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'm1-014.eventPromotion.source', 'M1-014 event source is not the frozen e351 M1-013 projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'events',
    previous,
    current,
    M1014_EVENT_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-014.eventPromotion.change-descriptors',
    'current event changes do not exactly match the frozen M1-014 descriptor set',
    compareM1014EventDescriptors,
  ));
  const expectedProjection = buildM1014EventExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'm1-014.eventPromotion.projection', 'the approved canonical event projection cannot be constructed from the frozen source, including the unchanged review-scheduled boundary'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1014_EVENT_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'm1-014.eventPromotion.expected-projection', 'the allowlisted M1-014 event projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('events', 'm1-014.eventPromotion.projection', 'current event catalog is not the unique frozen-source M1-014 projection'));
    }
  }
  return changes;
}

function compareM1014B26Promotion(previous, current, allowance) {
  if (!isValidM1014PromotionAllowance(allowance)) {
    return [describeChange('events', 'b26.m1-014.compatibilityPromotion', 'M1-014 B26 allowance cannot be applied without the frozen static-only gamification/social policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1014_B26_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'b26.m1-014.source', 'M1-014 B26 promotion source is not the frozen e351 M1-013 projection'));
  }
  const expectedProjection = buildM1014B26ExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'b26.m1-014.projection', 'the approved static M1-014 topics and routes cannot be constructed from the frozen source'));
  } else {
    changes.push(...compareFrozenDescriptorSet(
      'events',
      previous,
      current,
      M1014_B26_EXPECTED_CHANGE_DESCRIPTORS,
      'b26.m1-014.change-descriptors',
      'current B26 changes do not exactly match the frozen M1-014 descriptor set',
      compareM1014B26Descriptors,
    ));
    if (stableGovernanceSha256(expectedProjection) !== M1014_B26_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'b26.m1-014.expected-projection', 'the allowlisted static M1-014 B26 projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('events', 'b26.m1-014.projection', 'current B26 policy differs from the explicit static-only M1-014 projection'));
    }
  }
  return changes;
}

function isValidM1015PromotionAllowance(allowance) {
  return isRecord(allowance)
    && stableGovernanceValue(Object.keys(allowance).sort()) === stableGovernanceValue([...M1015_PROMOTION_ALLOWANCE_KEYS].sort())
    && allowance.id === M1015_COMMERCE_PROMOTION_ID
    && allowance.sourceContractBaseline === M1015_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1014_GAMIFICATION_SOCIAL_PROMOTION_ID
    && allowance.previousPromotionContract === 'config/p1r-gamification-social-contract.v1.json'
    && allowance.immutableGovernanceBaseline === M1015_IMMUTABLE_GOVERNANCE_BASELINE_REF
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'OPENAPI_EVENT_GOVERNANCE_M1015_V2_B26_STATIC_WITH_B5_B13_V1_B20_HISTORICAL'
    && allowance.promotionMode === 'FUTURE_M1015_V2_ONLY'
    && allowance.allowsHistoricalV1Promotion === false
    && allowance.allowsDualPublish === false
    && stableGovernanceSha256(allowance.approvedSourceFiles) === M1015_APPROVED_SOURCE_FILES_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.requiredCompatibilityChecks) === M1015_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.b26StaticPolicy) === M1015_B26_STATIC_POLICY_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.canonicalOpenApiSource) === M1015_CANONICAL_OPENAPI_SOURCE_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.canonicalEventSource) === M1015_CANONICAL_EVENT_SOURCE_SEMANTIC_SHA256;
}

function copyM1015Operation(expected, approved, projection) {
  const method = projection.method.toLowerCase();
  const approvedPath = approved?.paths?.[projection.path];
  if (!isRecord(approvedPath) || !isRecord(approvedPath[method])
    || approvedPath[method].operationId !== projection.operationId) return false;
  if (!Object.hasOwn(expected.paths ?? {}, projection.path)) {
    expected.paths[projection.path] = { [method]: structuredClone(approvedPath[method]) };
    return true;
  }
  const expectedPath = expected.paths[projection.path];
  if (!isRecord(expectedPath) || !isRecord(expectedPath[method])) return false;
  expectedPath[method] = structuredClone(approvedPath[method]);
  return true;
}

function insertM1015NamedEntry(target, approved, name) {
  if (!isRecord(target) || !isRecord(approved) || Object.hasOwn(target, name) || !isRecord(approved[name])) return false;
  target[name] = structuredClone(approved[name]);
  return true;
}

function insertM1015NamedArrayEntry(target, approved, key, name) {
  if (!Array.isArray(target) || !Array.isArray(approved)) return false;
  const targetMatches = target.filter((entry) => entry?.[key] === name);
  const approvedMatches = approved.filter((entry) => entry?.[key] === name);
  if (targetMatches.length !== 0 || approvedMatches.length !== 1) return false;
  const insertionIndex = approved.findIndex((entry) => entry?.[key] === name);
  if (insertionIndex < 0) return false;
  target.splice(insertionIndex, 0, structuredClone(approvedMatches[0]));
  return true;
}

function insertM1015ArrayValue(target, approved, value) {
  if (!Array.isArray(target) || !Array.isArray(approved)
    || target.includes(value) || approved.filter((entry) => entry === value).length !== 1) return false;
  const insertionIndex = approved.indexOf(value);
  const approvedWithoutValue = approved.filter((entry) => entry !== value);
  if (stableGovernanceValue(approvedWithoutValue) !== stableGovernanceValue(target)) return false;
  target.splice(insertionIndex, 0, value);
  return true;
}

function insertM1015FragmentInventoryEntry(expected, approved) {
  const previousInventory = expected?.['x-p1r-event-governance']?.fragmentInventory;
  const approvedInventory = approved?.['x-p1r-event-governance']?.fragmentInventory;
  const approvedEntry = Array.isArray(approvedInventory)
    ? approvedInventory.find((entry) => entry?.path === M1015_FRAGMENT_INVENTORY_ENTRY.path)
    : undefined;
  if (stableGovernanceValue(approvedEntry) !== stableGovernanceValue(M1015_FRAGMENT_INVENTORY_ENTRY)) return false;
  return insertM1015NamedArrayEntry(previousInventory, approvedInventory, 'path', M1015_FRAGMENT_INVENTORY_ENTRY.path);
}

export function buildM1015OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1015PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1015_OPENAPI_SOURCE_SEMANTIC_SHA256
    || !isRecord(previous.paths) || !isRecord(approved.paths)
    || !isRecord(previous.components?.parameters) || !isRecord(previous.components?.schemas)
    || !isRecord(approved.components?.parameters) || !isRecord(approved.components?.schemas)) return undefined;
  const expected = structuredClone(previous);
  const previousGatewayCount = previous?.['x-p1r-gateway-boundary']?.internalOperationPolicy?.baselineOperationCount;
  const approvedGatewayCount = approved?.['x-p1r-gateway-boundary']?.internalOperationPolicy?.baselineOperationCount;
  if (previousGatewayCount !== M1015_OPENAPI_GATEWAY_BASELINE_OPERATION_COUNT.from
    || approvedGatewayCount !== M1015_OPENAPI_GATEWAY_BASELINE_OPERATION_COUNT.to) return undefined;
  expected['x-p1r-gateway-boundary'].internalOperationPolicy.baselineOperationCount = approvedGatewayCount;
  if (!M1015_CANONICAL_ROUTE_PROJECTIONS.every((projection) => copyM1015Operation(expected, approved, projection))) return undefined;
  for (const name of M1015_OPENAPI_PARAMETER_PROJECTIONS) {
    if (!insertM1015NamedEntry(expected.components.parameters, approved.components.parameters, name)) return undefined;
  }
  for (const name of M1015_OPENAPI_SCHEMA_PROJECTIONS) {
    if (!insertM1015NamedEntry(expected.components.schemas, approved.components.schemas, name)) return undefined;
  }
  for (const name of M1015_OPENAPI_TAG_PROJECTIONS) {
    if (!insertM1015NamedArrayEntry(expected.tags, approved.tags, 'name', name)) return undefined;
  }
  return expected;
}

export function buildM1015EventExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1015PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1015_EVENT_SOURCE_SEMANTIC_SHA256
    || !isRecord(previous['x-p1r-event-governance']) || !isRecord(approved['x-p1r-event-governance'])) return undefined;
  const expected = structuredClone(previous);
  if (!insertM1015FragmentInventoryEntry(expected, approved)) return undefined;
  if (!insertM1015ArrayValue(expected.forbiddenPayloadFieldPatterns, approved.forbiddenPayloadFieldPatterns, M1015_FORBIDDEN_PAYLOAD_FIELD_PATTERNS[8])) return undefined;
  if (!M1015_EVENT_NAMES.every((name) => insertM1015NamedArrayEntry(expected.events, approved.events, 'eventName', name))) return undefined;
  if (!M1015_EVENT_PAYLOAD_SCHEMA_PROJECTIONS.every((name) => insertM1015NamedEntry(expected.payloadSchemas, approved.payloadSchemas, name))) return undefined;
  if (!M1015_ASYNCAPI_CHANNEL_PROJECTIONS.every((name) => insertM1015NamedEntry(expected.asyncapi?.channels, approved.asyncapi?.channels, name))) return undefined;
  if (!M1015_ASYNCAPI_OPERATION_PROJECTIONS.every((name) => insertM1015NamedEntry(expected.asyncapi?.operations, approved.asyncapi?.operations, name))) return undefined;
  return expected;
}

export function buildM1015B26ExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1015PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1015_B26_SOURCE_SEMANTIC_SHA256) return undefined;
  const expected = structuredClone(previous);
  if (!M1015_B26_TOPIC_PROJECTIONS.every((name) => insertM1015NamedArrayEntry(expected.topics, approved.topics, 'name', name))) return undefined;
  if (!M1015_B26_ROUTE_PROJECTIONS.every((name) => insertM1015NamedArrayEntry(expected.eventRouting, approved.eventRouting, 'eventName', name))) return undefined;
  return expected;
}

function compareM1015Value(changes, kind, previousValue, currentValue, location, reason) {
  if (stableGovernanceValue(previousValue) !== stableGovernanceValue(currentValue)) {
    changes.push(describeChange(kind, location, reason));
  }
}

export const M1015_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ...M1015_CANONICAL_ROUTE_PROJECTIONS.map((projection) => [
    `${projection.method} ${projection.path}`,
    'approved canonical M1-015 commerce operation changed',
  ]),
  ...M1015_OPENAPI_TAG_PROJECTIONS.map((name) => [`tags.${name}`, 'approved M1-015 API tag added']),
  [M1015_OPENAPI_GATEWAY_BASELINE_OPERATION_COUNT.location, 'approved M1-015 Gateway internal operation baseline count changed from 51 to 53'],
  ...M1015_OPENAPI_PARAMETER_PROJECTIONS.map((name) => [`components.parameters.${name}`, 'approved M1-015 component parameter added']),
  ...M1015_OPENAPI_SCHEMA_PROJECTIONS.map((name) => [`components.schemas.${name}`, 'approved M1-015 component schema added']),
]);

export const M1015_EVENT_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ['x-p1r-event-governance.fragmentInventory', 'approved M1-015 event fragment inventory updated'],
  ['forbiddenPayloadFieldPatterns', 'approved M1-015 forbidden payload patterns updated'],
  ...M1015_EVENT_NAMES.map((name) => [name, 'approved canonical M1-015 commerce event added']),
  ...M1015_EVENT_PAYLOAD_SCHEMA_PROJECTIONS.map((name) => [`payloadSchemas.${name}`, 'approved M1-015 event payload added']),
  ...M1015_ASYNCAPI_CHANNEL_PROJECTIONS.map((name) => [`asyncapi.channels.${name}`, 'approved M1-015 AsyncAPI channel added']),
  ...M1015_ASYNCAPI_OPERATION_PROJECTIONS.map((name) => [`asyncapi.operations.${name}`, 'approved M1-015 AsyncAPI operation added']),
]);

export const M1015_B26_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ...M1015_B26_TOPIC_PROJECTIONS.map((name) => [`topics.${name}`, 'approved M1-015 B26 topic added']),
  ...M1015_B26_ROUTE_PROJECTIONS.map((name) => [`eventRouting.${name}`, 'approved M1-015 B26 route added']),
]);

export function compareM1015OpenApiDescriptors(previous, current) {
  const changes = [];
  for (const projection of M1015_CANONICAL_ROUTE_PROJECTIONS) {
    const method = projection.method.toLowerCase();
    compareM1015Value(changes, 'openapi', previous?.paths?.[projection.path]?.[method], current?.paths?.[projection.path]?.[method], `${projection.method} ${projection.path}`, 'approved canonical M1-015 commerce operation changed');
  }
  for (const name of M1015_OPENAPI_TAG_PROJECTIONS) {
    compareM1015Value(changes, 'openapi', (previous?.tags ?? []).find((tag) => tag?.name === name), (current?.tags ?? []).find((tag) => tag?.name === name), `tags.${name}`, 'approved M1-015 API tag added');
  }
  compareM1015Value(
    changes,
    'openapi',
    previous?.['x-p1r-gateway-boundary']?.internalOperationPolicy?.baselineOperationCount,
    current?.['x-p1r-gateway-boundary']?.internalOperationPolicy?.baselineOperationCount,
    M1015_OPENAPI_GATEWAY_BASELINE_OPERATION_COUNT.location,
    'approved M1-015 Gateway internal operation baseline count changed from 51 to 53',
  );
  for (const name of M1015_OPENAPI_PARAMETER_PROJECTIONS) {
    compareM1015Value(changes, 'openapi', previous?.components?.parameters?.[name], current?.components?.parameters?.[name], `components.parameters.${name}`, 'approved M1-015 component parameter added');
  }
  for (const name of M1015_OPENAPI_SCHEMA_PROJECTIONS) {
    compareM1015Value(changes, 'openapi', previous?.components?.schemas?.[name], current?.components?.schemas?.[name], `components.schemas.${name}`, 'approved M1-015 component schema added');
  }
  return changes;
}

export function compareM1015EventDescriptors(previous, current) {
  const changes = [];
  compareM1015Value(changes, 'events', previous?.['x-p1r-event-governance']?.fragmentInventory, current?.['x-p1r-event-governance']?.fragmentInventory, 'x-p1r-event-governance.fragmentInventory', 'approved M1-015 event fragment inventory updated');
  compareM1015Value(changes, 'events', previous?.forbiddenPayloadFieldPatterns, current?.forbiddenPayloadFieldPatterns, 'forbiddenPayloadFieldPatterns', 'approved M1-015 forbidden payload patterns updated');
  for (const name of M1015_EVENT_NAMES) {
    compareM1015Value(changes, 'events', (previous?.events ?? []).find((event) => event?.eventName === name), (current?.events ?? []).find((event) => event?.eventName === name), name, 'approved canonical M1-015 commerce event added');
  }
  for (const name of M1015_EVENT_PAYLOAD_SCHEMA_PROJECTIONS) {
    compareM1015Value(changes, 'events', previous?.payloadSchemas?.[name], current?.payloadSchemas?.[name], `payloadSchemas.${name}`, 'approved M1-015 event payload added');
  }
  for (const name of M1015_ASYNCAPI_CHANNEL_PROJECTIONS) {
    compareM1015Value(changes, 'events', previous?.asyncapi?.channels?.[name], current?.asyncapi?.channels?.[name], `asyncapi.channels.${name}`, 'approved M1-015 AsyncAPI channel added');
  }
  for (const name of M1015_ASYNCAPI_OPERATION_PROJECTIONS) {
    compareM1015Value(changes, 'events', previous?.asyncapi?.operations?.[name], current?.asyncapi?.operations?.[name], `asyncapi.operations.${name}`, 'approved M1-015 AsyncAPI operation added');
  }
  return changes;
}

export function compareM1015B26Descriptors(previous, current) {
  const changes = [];
  for (const name of M1015_B26_TOPIC_PROJECTIONS) {
    compareM1015Value(changes, 'events', (previous?.topics ?? []).find((topic) => topic?.name === name), (current?.topics ?? []).find((topic) => topic?.name === name), `topics.${name}`, 'approved M1-015 B26 topic added');
  }
  for (const name of M1015_B26_ROUTE_PROJECTIONS) {
    compareM1015Value(changes, 'events', (previous?.eventRouting ?? []).find((entry) => entry?.eventName === name), (current?.eventRouting ?? []).find((entry) => entry?.eventName === name), `eventRouting.${name}`, 'approved M1-015 B26 route added');
  }
  return changes;
}

function compareM1015OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1015PromotionAllowance(allowance)) {
    return [describeChange('openapi', 'm1-015.openapiPromotion', 'M1-015 promotion allowance cannot be applied without the frozen commerce policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1015_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm1-015.openapiPromotion.source', 'M1-015 OpenAPI promotion source is not the frozen 5d0bb3a M1-014 projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'openapi',
    previous,
    current,
    M1015_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-015.openapiPromotion.change-descriptors',
    'current OpenAPI changes do not exactly match the frozen M1-015 descriptor set',
    compareM1015OpenApiDescriptors,
  ));
  const expectedProjection = buildM1015OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('openapi', 'm1-015.openapiPromotion.projection', 'the approved canonical commerce OpenAPI projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1015_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('openapi', 'm1-015.openapiPromotion.expected-projection', 'the allowlisted M1-015 OpenAPI projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('openapi', 'm1-015.openapiPromotion.projection', 'current OpenAPI is not the unique frozen-source M1-015 commerce projection'));
    }
  }
  return changes;
}

function compareM1015EventPromotion(previous, current, allowance) {
  if (!isValidM1015PromotionAllowance(allowance)) {
    return [describeChange('events', 'm1-015.eventPromotion', 'M1-015 event allowance cannot be applied without the frozen commerce policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1015_EVENT_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'm1-015.eventPromotion.source', 'M1-015 event source is not the frozen 5d0bb3a M1-014 projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'events',
    previous,
    current,
    M1015_EVENT_EXPECTED_CHANGE_DESCRIPTORS,
    'm1-015.eventPromotion.change-descriptors',
    'current event changes do not exactly match the frozen M1-015 descriptor set',
    compareM1015EventDescriptors,
  ));
  const expectedProjection = buildM1015EventExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'm1-015.eventPromotion.projection', 'the approved canonical commerce event projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1015_EVENT_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'm1-015.eventPromotion.expected-projection', 'the allowlisted M1-015 event projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('events', 'm1-015.eventPromotion.projection', 'current event catalog is not the unique frozen-source M1-015 commerce projection'));
    }
  }
  return changes;
}

function compareM1015B26Promotion(previous, current, allowance) {
  if (!isValidM1015PromotionAllowance(allowance)) {
    return [describeChange('events', 'b26.m1-015.compatibilityPromotion', 'M1-015 B26 allowance cannot be applied without the frozen commerce policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1015_B26_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('events', 'b26.m1-015.source', 'M1-015 B26 promotion source is not the frozen 5d0bb3a M1-014 projection'));
  }
  changes.push(...compareFrozenDescriptorSet(
    'events',
    previous,
    current,
    M1015_B26_EXPECTED_CHANGE_DESCRIPTORS,
    'b26.m1-015.change-descriptors',
    'current B26 changes do not exactly match the frozen M1-015 descriptor set',
    compareM1015B26Descriptors,
  ));
  const expectedProjection = buildM1015B26ExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'b26.m1-015.projection', 'the approved static M1-015 commerce topic and routes cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1015_B26_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('events', 'b26.m1-015.expected-projection', 'the allowlisted M1-015 B26 projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('events', 'b26.m1-015.projection', 'current B26 policy differs from the explicit static-only M1-015 commerce projection'));
    }
  }
  return changes;
}

// M1-016 is a source-bound notification/sync/support promotion.  The
// allowance is deliberately finite: B11/B5/B13 v1 remain historical adapters,
// while only the named M1-016 operations, schemas, event projections and B26
// static changes can be promoted from the 878f9eb source checkpoint.
export const M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID = 'P1R-M1-016';
export const M1016_SOURCE_CONTRACT_BASELINE_REF = '878f9ebc0591844467ac79facf4f00296058137f';
export const M1016_IMMUTABLE_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const M1016_OPENAPI_SOURCE_SEMANTIC_SHA256 = '919c96cb2f907429bd51e06badf2cc9937ad8491ca91ad7672e25fc1453af105';
export const M1016_EVENT_SOURCE_SEMANTIC_SHA256 = 'f54a7adc444e81b293e9d186df263e889bc63a69f1d40896f3d10fdf84098cca';
export const M1016_B26_SOURCE_SEMANTIC_SHA256 = '2fcf14ccdb34c4ce40cda36793c1bfe4234fa0de2af0de8066d9d739768c5a9b';
// Filled from the explicit frozen-source builders after the current
// canonical artifacts are revalidated.  These are intentionally not derived
// from the mutable current artifact at runtime.
export const M1016_OPENAPI_EXPECTED_SEMANTIC_SHA256 = 'd9e9f93e27e5e5249254d0433da7dd953d0cc9e6697da63def3ee037cb70255a';
export const M1016_EVENT_EXPECTED_SEMANTIC_SHA256 = '6517444993e9e26fa09f2558fd9fb0bf4f24a12d78071ddf3e40a3f30db919b8';
export const M1016_B26_EXPECTED_SEMANTIC_SHA256 = '6fa1b473ec91ab569d9be33f465e21651f20d372dd22d4ac25bae6fb10971120';
export const M1016_POLICY_SEMANTIC_SHA256 = 'f5beb694bb91ecde227d1405c56f7fdc73d71169d2bbe7b5c32378c3235f8ea7';
export const M1016_APPROVED_SOURCE_FILES_SEMANTIC_SHA256 = '17101bb26e4feb157e05c589b211fd06899e6c11185ac7e7ed2e08ca589ff8c3';
export const M1016_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256 = 'd6abcadf170d1cdddd113863439bdc4a8e13e82683483c9b3a9285002d2e5d6b';
export const M1016_B26_STATIC_POLICY_SEMANTIC_SHA256 = 'a967b692a61463029d4d899d8ebe32fbad0b57d1113824be5c9ad8a9dea4387e';
export const M1016_CANONICAL_OPENAPI_SOURCE_SEMANTIC_SHA256 = '1f2e9cad834f2593fad58bf57ecbf7c8825fefe990d7bedd73ce8a3387ffbd11';
export const M1016_CANONICAL_EVENT_SOURCE_SEMANTIC_SHA256 = 'b3f9fb4563a32ceb7e365679dc08ac326b65bc14766412c7738eefe64be7a323';
export const M1016_PROMOTION_ALLOWANCE_KEYS = Object.freeze([
  'id', 'sourceContractBaseline', 'previousPromotion', 'previousPromotionContract',
  'immutableGovernanceBaseline', 'runtimeStatus', 'scope', 'promotionMode',
  'allowsHistoricalV1Promotion', 'allowsDualPublish', 'approvedSourceFiles',
  'requiredCompatibilityChecks', 'b26StaticPolicy', 'canonicalOpenApiSource',
  'canonicalEventSource',
]);

export const M1016_CANONICAL_ROUTE_PROJECTIONS = Object.freeze([
  Object.freeze({ id: 'M1016-SYNC-RECEIPTS', method: 'GET', path: '/api/v1/learning/sync/receipts', operationId: 'listM1016LearningSyncReceipts' }),
  Object.freeze({ id: 'M1016-SYNC-CURSOR', method: 'GET', path: '/api/v1/learning/sync/cursor', operationId: 'getM1016LearningSyncCursor' }),
  Object.freeze({ id: 'M1016-SYNC-CONFLICTS', method: 'GET', path: '/api/v1/learning/sync/conflicts', operationId: 'listM1016LearningSyncConflicts' }),
  Object.freeze({ id: 'M1016-SYNC-RECOVERY', method: 'POST', path: '/api/v1/learning/sync/conflicts/{conflictId}/recovery', operationId: 'recoverM1016LearningSyncConflict' }),
  Object.freeze({ id: 'M1016-NOTIFICATION-PREFERENCES', method: 'GET', path: '/api/v1/notifications/preferences', operationId: 'listM1016NotificationPreferences' }),
  Object.freeze({ id: 'M1016-NOTIFICATION-PREFERENCE-UPDATE', method: 'PUT', path: '/api/v1/notifications/preferences/{notificationType}/{channel}', operationId: 'updateM1016NotificationPreference' }),
  Object.freeze({ id: 'M1016-NOTIFICATION-MESSAGES', method: 'GET', path: '/api/v1/notifications/messages', operationId: 'listM1016NotificationMessages' }),
  Object.freeze({ id: 'M1016-NOTIFICATION-MESSAGE-READ', method: 'PUT', path: '/api/v1/notifications/messages/{messageId}/read', operationId: 'markM1016NotificationMessageRead' }),
  Object.freeze({ id: 'M1016-NOTIFICATION-MESSAGES-READ-ALL', method: 'PUT', path: '/api/v1/notifications/messages/read-all', operationId: 'markAllM1016NotificationMessagesRead' }),
  Object.freeze({ id: 'M1016-NOTIFICATION-RETRY', method: 'POST', path: '/internal/v1/notifications/retry', operationId: 'retryM1016NotificationDelivery' }),
  Object.freeze({ id: 'M1016-NOTIFICATION-RECOVERY', method: 'POST', path: '/internal/v1/notifications/recovery', operationId: 'recoverM1016NotificationDelivery' }),
  Object.freeze({ id: 'M1016-LEARNER-SUPPORT-LIST', method: 'GET', path: '/api/v1/support/tickets', operationId: 'listM1016LearnerSupportTickets' }),
  Object.freeze({ id: 'M1016-LEARNER-SUPPORT-CREATE', method: 'POST', path: '/api/v1/support/tickets', operationId: 'createM1016SupportTicket' }),
  Object.freeze({ id: 'M1016-LEARNER-SUPPORT-GET', method: 'GET', path: '/api/v1/support/tickets/{ticketId}', operationId: 'getM1016LearnerSupportTicket' }),
  Object.freeze({ id: 'M1016-LEARNER-SUPPORT-MESSAGE', method: 'POST', path: '/api/v1/support/tickets/{ticketId}/messages', operationId: 'addM1016LearnerSupportTicketMessage' }),
  Object.freeze({ id: 'M1016-ADMIN-SUPPORT-LIST', method: 'GET', path: '/api/v1/admin/ops/tickets', operationId: 'listM1016AdminSupportTickets' }),
  Object.freeze({ id: 'M1016-ADMIN-SUPPORT-GET', method: 'GET', path: '/api/v1/admin/ops/tickets/{ticketId}', operationId: 'getM1016AdminSupportTicket' }),
  Object.freeze({ id: 'M1016-ADMIN-SUPPORT-MESSAGE', method: 'POST', path: '/api/v1/admin/ops/tickets/{ticketId}/messages', operationId: 'addM1016AdminSupportTicketMessage' }),
  Object.freeze({ id: 'M1016-ADMIN-SUPPORT-COMMAND', method: 'POST', path: '/api/v1/admin/ops/tickets/{ticketId}/commands', operationId: 'submitM1016SupportTicketCommand' }),
]);

// These adapter operations are intentionally part of the M1-016 projection
// only for their explicit historical/deprecation and fail-closed migration
// contract. Their v1 domain semantics are not promoted; the B13 create adapter
// maps a closed request to the sole canonical support owner without accepting
// client-owned priority, tenant, assignment, SLA or state.
export const M1016_HISTORICAL_ADAPTER_ROUTE_PROJECTIONS = Object.freeze([
  Object.freeze({ id: 'M1016-HISTORICAL-SYNC-ENQUEUE', method: 'POST', path: '/api/v1/sync/changes', operationId: 'enqueueB11SyncChanges' }),
  Object.freeze({ id: 'M1016-HISTORICAL-SYNC-LIST', method: 'GET', path: '/api/v1/sync/changes', operationId: 'listB11SyncChanges' }),
  Object.freeze({ id: 'M1016-HISTORICAL-NOTIFICATION-SETTINGS-GET', method: 'GET', path: '/api/v1/settings/notifications', operationId: 'getB11NotificationPreference' }),
  Object.freeze({ id: 'M1016-HISTORICAL-NOTIFICATION-SETTINGS-UPDATE', method: 'PUT', path: '/api/v1/settings/notifications', operationId: 'updateB11NotificationPreference' }),
  Object.freeze({ id: 'M1016-HISTORICAL-MESSAGES-LIST', method: 'GET', path: '/api/v1/messages', operationId: 'listB11Messages' }),
  Object.freeze({ id: 'M1016-HISTORICAL-MESSAGE-READ', method: 'POST', path: '/api/v1/messages/{messageId}/read', operationId: 'markB11MessageRead' }),
  Object.freeze({ id: 'M1016-HISTORICAL-SYNC-CURSOR-GET', method: 'GET', path: '/api/v1/sync/cursor', operationId: 'getB11SyncCursor' }),
  Object.freeze({ id: 'M1016-HISTORICAL-SYNC-CURSOR-UPDATE', method: 'PUT', path: '/api/v1/sync/cursor', operationId: 'updateB11SyncCursor' }),
  Object.freeze({ id: 'M1016-HISTORICAL-SYNC-CONFLICTS', method: 'GET', path: '/api/v1/sync/conflicts', operationId: 'listB11SyncConflicts' }),
  Object.freeze({ id: 'M1016-HISTORICAL-SYNC-RECOVERY', method: 'POST', path: '/api/v1/sync/conflicts/{conflictId}/recovery', operationId: 'recoverB11SyncConflict' }),
  Object.freeze({ id: 'M1016-HISTORICAL-TRUSTED-EVENTS', method: 'POST', path: '/internal/v1/notifications/trusted-events', operationId: 'consumeB12NotificationTrustedEvent' }),
  Object.freeze({ id: 'M1016-HISTORICAL-ADMIN-SUPPORT-CREATE', method: 'POST', path: '/api/v1/admin/ops/tickets', operationId: 'createB13SupportTicket' }),
]);
export const M1016_B5_STABLE_PARAMETER_PROJECTIONS = Object.freeze(['B5TicketId', 'B5IdempotencyKey']);
export const M1016_OPENAPI_PARAMETER_PROJECTIONS = Object.freeze(['M1016ConflictId', 'M1016IdempotencyKey', 'M1016SupportTicketId']);
export const M1016_OPENAPI_SCHEMA_PROJECTIONS = Object.freeze([
  'M1016SyncProtocolContext', 'M1016SyncReceipt', 'M1016SyncCursor', 'M1016SyncConflict',
  'M1016SyncRecoveryRequest', 'M1016SyncRecoveryResult', 'M1016NotificationDndWindow',
  'M1016NotificationPreference', 'M1016NotificationPreferenceCommand', 'M1016NotificationMessage',
  'M1016NotificationReadReceipt', 'M1016NotificationReadAllReceipt', 'M1016NotificationRetryCommand',
  'M1016NotificationRetryResult', 'M1016NotificationRecoveryCommand', 'M1016NotificationRecoveryResult',
  'M1016SupportRestrictedContentRef', 'M1016SupportAttachmentRef', 'M1016SupportUsableContentRef',
  'M1016SupportUsableAttachmentRef', 'M1016SupportAssignmentHistory', 'M1016SupportAssignment',
  'M1016SupportSlaHistory', 'M1016SupportSla', 'M1016SupportResolution', 'M1016SupportRetention',
  'M1016SupportTicket', 'M1016SupportTicketCreateRequest', 'M1016SupportMessage',
  'M1016SupportMessageCreateRequest', 'M1016SupportAssignCommand', 'M1016SupportTransitionCommand',
  'M1016SupportResolveCommand', 'M1016SupportAdminCommandRequest', 'M1016SupportCommandResult',
]);
export const M1016_OPENAPI_TAG_PROJECTIONS = Object.freeze(['M1-016-Sync', 'M1-016-Notification', 'M1-016-Support']);

export const M1016_EVENT_NAMES = Object.freeze([
  'notification.requested.v2', 'notification.retry_scheduled.v2', 'notification.recovery.completed.v2',
  'sync.command_receipted.v2', 'sync.conflict_detected.v2', 'sync.recovered.v2',
  'support.ticket.created.v2', 'support.ticket.resolved.v2',
]);
export const M1016_REWIRED_EVENT_NAMES = Object.freeze([
  'learning.review.scheduled.v2', 'commerce.entitlement.activated.v2', 'commerce.refund.settled.v2',
]);
export const M1016_EVENT_PAYLOAD_SCHEMA_PROJECTIONS = Object.freeze([
  'M1016NotificationRequested', 'M1016NotificationRetryScheduled', 'M1016NotificationRecoveryCompleted',
  'M1016SyncCommandReceipted', 'M1016SyncConflictDetected', 'M1016SyncRecovered',
  'M1016SupportTicketCreated', 'M1016SupportTicketResolved',
]);
export const M1016_EVENT_CONSUMERS = Object.freeze({
  'notification.requested.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-notification.v1' }),
    Object.freeze({ service: 'analytics-service', consumerGroup: 'cg.analytics-from-notification.v1' }),
  ]),
  'notification.retry_scheduled.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-notification.v1' }),
  ]),
  'notification.recovery.completed.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-notification.v1' }),
    Object.freeze({ service: 'analytics-service', consumerGroup: 'cg.analytics-from-notification.v1' }),
  ]),
  'sync.command_receipted.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-learning.v1' }),
  ]),
  'sync.conflict_detected.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-learning.v1' }),
  ]),
  'sync.recovered.v2': Object.freeze([
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-learning.v1' }),
  ]),
  'support.ticket.created.v2': Object.freeze([
    Object.freeze({ service: 'notification-service', consumerGroup: 'cg.notification-from-admin-ops.v1' }),
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-admin-ops.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-admin-ops.v1' }),
  ]),
  'support.ticket.resolved.v2': Object.freeze([
    Object.freeze({ service: 'notification-service', consumerGroup: 'cg.notification-from-admin-ops.v1' }),
    Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-admin-ops.v1' }),
    Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-admin-ops.v1' }),
  ]),
});
export const M1016_ASYNCAPI_CHANNEL_PROJECTIONS = Object.freeze(M1016_EVENT_NAMES.map((eventName) => eventName.replaceAll('.', '_')));
export const M1016_ASYNCAPI_OPERATION_PROJECTIONS = Object.freeze([
  'subscribe_learning_review_scheduled_v2_cg_notification_from_learning_v1',
  'subscribe_commerce_entitlement_activated_v2_cg_notification_from_commerce_v1',
  'subscribe_commerce_refund_settled_v2_cg_notification_from_commerce_v1',
  'publish_notification_requested_v2',
  'subscribe_notification_requested_v2_cg_workflow_from_notification_v1',
  'subscribe_notification_requested_v2_cg_analytics_from_notification_v1',
  'publish_notification_retry_scheduled_v2',
  'subscribe_notification_retry_scheduled_v2_cg_workflow_from_notification_v1',
  'publish_notification_recovery_completed_v2',
  'subscribe_notification_recovery_completed_v2_cg_workflow_from_notification_v1',
  'subscribe_notification_recovery_completed_v2_cg_analytics_from_notification_v1',
  'publish_sync_command_receipted_v2',
  'subscribe_sync_command_receipted_v2_cg_workflow_from_learning_v1',
  'publish_sync_conflict_detected_v2',
  'subscribe_sync_conflict_detected_v2_cg_workflow_from_learning_v1',
  'publish_sync_recovered_v2',
  'subscribe_sync_recovered_v2_cg_workflow_from_learning_v1',
  'publish_support_ticket_created_v2',
  'subscribe_support_ticket_created_v2_cg_notification_from_admin_ops_v1',
  'subscribe_support_ticket_created_v2_cg_workflow_from_admin_ops_v1',
  'subscribe_support_ticket_created_v2_cg_audit_from_admin_ops_v1',
  'publish_support_ticket_resolved_v2',
  'subscribe_support_ticket_resolved_v2_cg_notification_from_admin_ops_v1',
  'subscribe_support_ticket_resolved_v2_cg_workflow_from_admin_ops_v1',
  'subscribe_support_ticket_resolved_v2_cg_audit_from_admin_ops_v1',
]);
export const M1016_FRAGMENT_INVENTORY_ENTRY = Object.freeze({
  path: 'packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json',
  eventNames: M1016_EVENT_NAMES,
});
export const M1016_EVENT_GOVERNANCE_CLOSURE = Object.freeze({
  gapId: 'EVENT-GAP-BIND-NOTIF-001',
  family: 'EVENT-GAP-BIND',
  status: 'D2_CONTRACT_CLOSED',
  d2ClosureTasks: ['P1R-M1-006', 'P1R-M1-016'],
});

export const M1016_B26_SOURCE_REF = 'packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json';
export const M1016_B26_ADDED_TOPIC_PROJECTIONS = Object.freeze(['platform.admin-ops.v1']);
export const M1016_B26_REPLACED_TOPIC_PROJECTIONS = Object.freeze(['platform.commerce.v1']);
export const M1016_B26_ADDED_ROUTE_PROJECTIONS = Object.freeze([...M1016_EVENT_NAMES]);
export const M1016_B26_REPLACED_ROUTE_PROJECTIONS = Object.freeze([
  'commerce.entitlement.activated.v2', 'commerce.refund.settled.v2', 'learning.review.scheduled.v2',
]);

export function isValidM1016PromotionAllowance(allowance) {
  return isRecord(allowance)
    && stableGovernanceValue(Object.keys(allowance).sort()) === stableGovernanceValue([...M1016_PROMOTION_ALLOWANCE_KEYS].sort())
    && allowance.id === M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID
    && allowance.sourceContractBaseline === M1016_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1015_COMMERCE_PROMOTION_ID
    && allowance.previousPromotionContract === 'config/p1r-commerce-contract.v1.json'
    && allowance.immutableGovernanceBaseline === M1016_IMMUTABLE_GOVERNANCE_BASELINE_REF
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'M1016_OPENAPI_EVENT_GOVERNANCE_B26_STATIC_WITH_B11_B5_B13_V1_HISTORICAL'
    && allowance.promotionMode === 'FUTURE_M1016_V2_ONLY'
    && allowance.allowsHistoricalV1Promotion === false
    && allowance.allowsDualPublish === false
    && stableGovernanceSha256(allowance.approvedSourceFiles) === M1016_APPROVED_SOURCE_FILES_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.requiredCompatibilityChecks) === M1016_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.b26StaticPolicy) === M1016_B26_STATIC_POLICY_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.canonicalOpenApiSource) === M1016_CANONICAL_OPENAPI_SOURCE_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.canonicalEventSource) === M1016_CANONICAL_EVENT_SOURCE_SEMANTIC_SHA256;
}

function replaceM1016NamedArrayEntry(target, approved, key, name) {
  if (!Array.isArray(target) || !Array.isArray(approved)) return false;
  const targetMatches = target.filter((entry) => entry?.[key] === name);
  const approvedMatches = approved.filter((entry) => entry?.[key] === name);
  if (targetMatches.length !== 1 || approvedMatches.length !== 1) return false;
  const targetIndex = target.findIndex((entry) => entry?.[key] === name);
  target[targetIndex] = structuredClone(approvedMatches[0]);
  return true;
}

function insertM1016FragmentInventoryEntry(expected, approved) {
  const previousInventory = expected?.['x-p1r-event-governance']?.fragmentInventory;
  const approvedInventory = approved?.['x-p1r-event-governance']?.fragmentInventory;
  const approvedEntry = Array.isArray(approvedInventory)
    ? approvedInventory.find((entry) => entry?.path === M1016_FRAGMENT_INVENTORY_ENTRY.path)
    : undefined;
  if (stableGovernanceValue(approvedEntry) !== stableGovernanceValue(M1016_FRAGMENT_INVENTORY_ENTRY)) return false;
  return insertM1015NamedArrayEntry(previousInventory, approvedInventory, 'path', M1016_FRAGMENT_INVENTORY_ENTRY.path);
}

function replaceM1016EventGovernanceClosure(expected, approved) {
  const previousClosures = expected?.['x-p1r-event-governance']?.plannedClosures;
  const approvedClosures = approved?.['x-p1r-event-governance']?.plannedClosures;
  const approvedMatches = Array.isArray(approvedClosures)
    ? approvedClosures.filter((entry) => entry?.gapId === M1016_EVENT_GOVERNANCE_CLOSURE.gapId)
    : [];
  if (approvedMatches.length !== 1 || stableGovernanceValue(approvedMatches[0]) !== stableGovernanceValue(M1016_EVENT_GOVERNANCE_CLOSURE)) return false;
  return replaceM1016NamedArrayEntry(previousClosures, approvedClosures, 'gapId', M1016_EVENT_GOVERNANCE_CLOSURE.gapId);
}

export function buildM1016OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1016PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1016_OPENAPI_SOURCE_SEMANTIC_SHA256
    || !isRecord(previous.paths) || !isRecord(approved.paths)
    || !isRecord(previous.components?.parameters) || !isRecord(previous.components?.schemas)
    || !isRecord(approved.components?.parameters) || !isRecord(approved.components?.schemas)
    || !Array.isArray(previous.tags) || !Array.isArray(approved.tags)) return undefined;
  const expected = structuredClone(previous);
  // The two B5 parameters are pre-existing stable identity inputs.  They are
  // checked, never copied from a mutable current node.
  for (const name of M1016_B5_STABLE_PARAMETER_PROJECTIONS) {
    if (!Object.hasOwn(previous.components.parameters, name)
      || !Object.hasOwn(approved.components.parameters, name)
      || stableGovernanceValue(previous.components.parameters[name]) !== stableGovernanceValue(approved.components.parameters[name])) return undefined;
  }
  if (!M1016_CANONICAL_ROUTE_PROJECTIONS.every((projection) => copyM1015Operation(expected, approved, projection))) return undefined;
  if (!M1016_HISTORICAL_ADAPTER_ROUTE_PROJECTIONS.every((projection) => copyM1015Operation(expected, approved, projection))) return undefined;
  for (const name of M1016_OPENAPI_PARAMETER_PROJECTIONS) {
    if (!insertM1015NamedEntry(expected.components.parameters, approved.components.parameters, name)) return undefined;
  }
  for (const name of M1016_OPENAPI_SCHEMA_PROJECTIONS) {
    if (!insertM1015NamedEntry(expected.components.schemas, approved.components.schemas, name)) return undefined;
  }
  for (const name of M1016_OPENAPI_TAG_PROJECTIONS) {
    if (!insertM1015NamedArrayEntry(expected.tags, approved.tags, 'name', name)) return undefined;
  }
  return expected;
}

export function buildM1016EventExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1016PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1016_EVENT_SOURCE_SEMANTIC_SHA256
    || !isRecord(previous['x-p1r-event-governance']) || !isRecord(approved['x-p1r-event-governance'])) return undefined;
  const expected = structuredClone(previous);
  if (!insertM1016FragmentInventoryEntry(expected, approved)) return undefined;
  if (!replaceM1016EventGovernanceClosure(expected, approved)) return undefined;
  if (!M1016_REWIRED_EVENT_NAMES.every((name) => replaceM1016NamedArrayEntry(expected.events, approved.events, 'eventName', name))) return undefined;
  if (!M1016_EVENT_NAMES.every((name) => insertM1015NamedArrayEntry(expected.events, approved.events, 'eventName', name))) return undefined;
  if (!M1016_EVENT_PAYLOAD_SCHEMA_PROJECTIONS.every((name) => insertM1015NamedEntry(expected.payloadSchemas, approved.payloadSchemas, name))) return undefined;
  if (!M1016_ASYNCAPI_CHANNEL_PROJECTIONS.every((name) => insertM1015NamedEntry(expected.asyncapi?.channels, approved.asyncapi?.channels, name))) return undefined;
  if (!M1016_ASYNCAPI_OPERATION_PROJECTIONS.every((name) => insertM1015NamedEntry(expected.asyncapi?.operations, approved.asyncapi?.operations, name))) return undefined;
  return expected;
}

export function buildM1016B26ExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1016PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1016_B26_SOURCE_SEMANTIC_SHA256
    || !Array.isArray(previous.sourceRefs) || !Array.isArray(approved.sourceRefs)
    || !Array.isArray(previous.topics) || !Array.isArray(approved.topics)
    || !Array.isArray(previous.eventRouting) || !Array.isArray(approved.eventRouting)) return undefined;
  const expected = structuredClone(previous);
  if (!insertM1015ArrayValue(expected.sourceRefs, approved.sourceRefs, M1016_B26_SOURCE_REF)) return undefined;
  if (!M1016_B26_ADDED_TOPIC_PROJECTIONS.every((name) => insertM1015NamedArrayEntry(expected.topics, approved.topics, 'name', name))) return undefined;
  if (!M1016_B26_REPLACED_TOPIC_PROJECTIONS.every((name) => replaceM1016NamedArrayEntry(expected.topics, approved.topics, 'name', name))) return undefined;
  if (!M1016_B26_ADDED_ROUTE_PROJECTIONS.every((name) => insertM1015NamedArrayEntry(expected.eventRouting, approved.eventRouting, 'eventName', name))) return undefined;
  if (!M1016_B26_REPLACED_ROUTE_PROJECTIONS.every((name) => replaceM1016NamedArrayEntry(expected.eventRouting, approved.eventRouting, 'eventName', name))) return undefined;
  return expected;
}

function compareM1016Value(changes, kind, previousValue, currentValue, location, reason) {
  if (stableGovernanceValue(previousValue) !== stableGovernanceValue(currentValue)) {
    changes.push(describeChange(kind, location, reason));
  }
}

export const M1016_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ...M1016_CANONICAL_ROUTE_PROJECTIONS.map((projection) => [
    `${projection.method} ${projection.path}`, 'approved canonical M1-016 operation changed',
  ]),
  ...M1016_HISTORICAL_ADAPTER_ROUTE_PROJECTIONS.map((projection) => [
    `${projection.method} ${projection.path}`, 'approved historical M1-016 adapter migration contract changed',
  ]),
  ...M1016_OPENAPI_TAG_PROJECTIONS.map((name) => [`tags.${name}`, 'approved M1-016 API tag added']),
  ...M1016_OPENAPI_PARAMETER_PROJECTIONS.map((name) => [`components.parameters.${name}`, 'approved M1-016 component parameter added']),
  ...M1016_OPENAPI_SCHEMA_PROJECTIONS.map((name) => [`components.schemas.${name}`, 'approved M1-016 component schema added']),
]);

export const M1016_EVENT_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ['x-p1r-event-governance.fragmentInventory', 'approved M1-016 event fragment inventory updated'],
  ['x-p1r-event-governance.plannedClosures.EVENT-GAP-BIND-NOTIF-001', 'approved M1-016 event gap closure recorded'],
  ...M1016_REWIRED_EVENT_NAMES.map((name) => [name, 'approved M1-016 event consumer binding added']),
  ...M1016_EVENT_NAMES.map((name) => [name, 'approved canonical M1-016 event added']),
  ...M1016_EVENT_PAYLOAD_SCHEMA_PROJECTIONS.map((name) => [`payloadSchemas.${name}`, 'approved M1-016 event payload added']),
  ...M1016_ASYNCAPI_CHANNEL_PROJECTIONS.map((name) => [`asyncapi.channels.${name}`, 'approved M1-016 AsyncAPI channel added']),
  ...M1016_ASYNCAPI_OPERATION_PROJECTIONS.map((name) => [`asyncapi.operations.${name}`, 'approved M1-016 AsyncAPI operation added']),
]);

export const M1016_B26_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ['sourceRefs', 'approved M1-016 event fragment source reference added'],
  ...M1016_B26_ADDED_TOPIC_PROJECTIONS.map((name) => [`topics.${name}`, 'approved M1-016 B26 topic added']),
  ...M1016_B26_REPLACED_TOPIC_PROJECTIONS.map((name) => [`topics.${name}`, 'approved M1-016 B26 topic consumer policy changed']),
  ...M1016_B26_ADDED_ROUTE_PROJECTIONS.map((name) => [`eventRouting.${name}`, 'approved M1-016 B26 route added']),
  ...M1016_B26_REPLACED_ROUTE_PROJECTIONS.map((name) => [`eventRouting.${name}`, 'approved M1-016 B26 route consumer policy changed']),
]);

export function compareM1016OpenApiDescriptors(previous, current) {
  const changes = [];
  for (const projection of [...M1016_CANONICAL_ROUTE_PROJECTIONS, ...M1016_HISTORICAL_ADAPTER_ROUTE_PROJECTIONS]) {
    const method = projection.method.toLowerCase();
    compareM1016Value(changes, 'openapi', previous?.paths?.[projection.path]?.[method], current?.paths?.[projection.path]?.[method], `${projection.method} ${projection.path}`, projection.id.startsWith('M1016-HISTORICAL-') ? 'approved historical M1-016 adapter migration contract changed' : 'approved canonical M1-016 operation changed');
  }
  for (const name of M1016_OPENAPI_TAG_PROJECTIONS) {
    compareM1016Value(changes, 'openapi', (previous?.tags ?? []).find((tag) => tag?.name === name), (current?.tags ?? []).find((tag) => tag?.name === name), `tags.${name}`, 'approved M1-016 API tag added');
  }
  for (const name of M1016_OPENAPI_PARAMETER_PROJECTIONS) {
    compareM1016Value(changes, 'openapi', previous?.components?.parameters?.[name], current?.components?.parameters?.[name], `components.parameters.${name}`, 'approved M1-016 component parameter added');
  }
  for (const name of M1016_OPENAPI_SCHEMA_PROJECTIONS) {
    compareM1016Value(changes, 'openapi', previous?.components?.schemas?.[name], current?.components?.schemas?.[name], `components.schemas.${name}`, 'approved M1-016 component schema added');
  }
  return changes;
}

export function compareM1016EventDescriptors(previous, current) {
  const changes = [];
  compareM1016Value(changes, 'events', previous?.['x-p1r-event-governance']?.fragmentInventory, current?.['x-p1r-event-governance']?.fragmentInventory, 'x-p1r-event-governance.fragmentInventory', 'approved M1-016 event fragment inventory updated');
  compareM1016Value(changes, 'events', (previous?.['x-p1r-event-governance']?.plannedClosures ?? []).find((entry) => entry?.gapId === M1016_EVENT_GOVERNANCE_CLOSURE.gapId), (current?.['x-p1r-event-governance']?.plannedClosures ?? []).find((entry) => entry?.gapId === M1016_EVENT_GOVERNANCE_CLOSURE.gapId), 'x-p1r-event-governance.plannedClosures.EVENT-GAP-BIND-NOTIF-001', 'approved M1-016 event gap closure recorded');
  for (const name of M1016_EVENT_NAMES) {
    compareM1016Value(changes, 'events', (previous?.events ?? []).find((event) => event?.eventName === name), (current?.events ?? []).find((event) => event?.eventName === name), name, 'approved canonical M1-016 event added');
  }
  for (const name of M1016_REWIRED_EVENT_NAMES) {
    compareM1016Value(changes, 'events', (previous?.events ?? []).find((event) => event?.eventName === name), (current?.events ?? []).find((event) => event?.eventName === name), name, 'approved M1-016 event consumer binding added');
  }
  for (const name of M1016_EVENT_PAYLOAD_SCHEMA_PROJECTIONS) {
    compareM1016Value(changes, 'events', previous?.payloadSchemas?.[name], current?.payloadSchemas?.[name], `payloadSchemas.${name}`, 'approved M1-016 event payload added');
  }
  for (const name of M1016_ASYNCAPI_CHANNEL_PROJECTIONS) {
    compareM1016Value(changes, 'events', previous?.asyncapi?.channels?.[name], current?.asyncapi?.channels?.[name], `asyncapi.channels.${name}`, 'approved M1-016 AsyncAPI channel added');
  }
  for (const name of M1016_ASYNCAPI_OPERATION_PROJECTIONS) {
    compareM1016Value(changes, 'events', previous?.asyncapi?.operations?.[name], current?.asyncapi?.operations?.[name], `asyncapi.operations.${name}`, 'approved M1-016 AsyncAPI operation added');
  }
  return changes;
}

export function compareM1016B26Descriptors(previous, current) {
  const changes = [];
  compareM1016Value(changes, 'events', previous?.sourceRefs, current?.sourceRefs, 'sourceRefs', 'approved M1-016 event fragment source reference added');
  for (const name of M1016_B26_ADDED_TOPIC_PROJECTIONS) {
    compareM1016Value(changes, 'events', (previous?.topics ?? []).find((topic) => topic?.name === name), (current?.topics ?? []).find((topic) => topic?.name === name), `topics.${name}`, 'approved M1-016 B26 topic added');
  }
  for (const name of M1016_B26_REPLACED_TOPIC_PROJECTIONS) {
    compareM1016Value(changes, 'events', (previous?.topics ?? []).find((topic) => topic?.name === name), (current?.topics ?? []).find((topic) => topic?.name === name), `topics.${name}`, 'approved M1-016 B26 topic consumer policy changed');
  }
  for (const name of M1016_B26_ADDED_ROUTE_PROJECTIONS) {
    compareM1016Value(changes, 'events', (previous?.eventRouting ?? []).find((entry) => entry?.eventName === name), (current?.eventRouting ?? []).find((entry) => entry?.eventName === name), `eventRouting.${name}`, 'approved M1-016 B26 route added');
  }
  for (const name of M1016_B26_REPLACED_ROUTE_PROJECTIONS) {
    compareM1016Value(changes, 'events', (previous?.eventRouting ?? []).find((entry) => entry?.eventName === name), (current?.eventRouting ?? []).find((entry) => entry?.eventName === name), `eventRouting.${name}`, 'approved M1-016 B26 route consumer policy changed');
  }
  return changes;
}

function compareM1016OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1016PromotionAllowance(allowance)) {
    return [describeChange('openapi', 'm1-016.openapiPromotion', 'M1-016 promotion allowance cannot be applied without the frozen notification/sync/support policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1016_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm1-016.openapiPromotion.source', 'M1-016 OpenAPI promotion source is not the frozen 878f9eb source projection'));
  }
  changes.push(...compareFrozenDescriptorSet('openapi', previous, current, M1016_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS, 'm1-016.openapiPromotion.change-descriptors', 'current OpenAPI changes do not exactly match the frozen M1-016 descriptor set', compareM1016OpenApiDescriptors));
  const expectedProjection = buildM1016OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('openapi', 'm1-016.openapiPromotion.projection', 'the approved canonical M1-016 OpenAPI projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1016_OPENAPI_EXPECTED_SEMANTIC_SHA256) changes.push(describeChange('openapi', 'm1-016.openapiPromotion.expected-projection', 'the allowlisted M1-016 OpenAPI projection does not match its frozen semantic digest'));
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) changes.push(describeChange('openapi', 'm1-016.openapiPromotion.projection', 'current OpenAPI is not the unique frozen-source M1-016 projection'));
  }
  return changes;
}

function compareM1016EventPromotion(previous, current, allowance) {
  if (!isValidM1016PromotionAllowance(allowance)) {
    return [describeChange('events', 'm1-016.eventPromotion', 'M1-016 event allowance cannot be applied without the frozen notification/sync/support policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1016_EVENT_SOURCE_SEMANTIC_SHA256) changes.push(describeChange('events', 'm1-016.eventPromotion.source', 'M1-016 event source is not the frozen 878f9eb source projection'));
  changes.push(...compareFrozenDescriptorSet('events', previous, current, M1016_EVENT_EXPECTED_CHANGE_DESCRIPTORS, 'm1-016.eventPromotion.change-descriptors', 'current event changes do not exactly match the frozen M1-016 descriptor set', compareM1016EventDescriptors));
  const expectedProjection = buildM1016EventExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'm1-016.eventPromotion.projection', 'the approved canonical M1-016 event projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1016_EVENT_EXPECTED_SEMANTIC_SHA256) changes.push(describeChange('events', 'm1-016.eventPromotion.expected-projection', 'the allowlisted M1-016 event projection does not match its frozen semantic digest'));
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) changes.push(describeChange('events', 'm1-016.eventPromotion.projection', 'current event catalog is not the unique frozen-source M1-016 projection'));
  }
  return changes;
}

function compareM1016B26Promotion(previous, current, allowance) {
  if (!isValidM1016PromotionAllowance(allowance)) {
    return [describeChange('events', 'b26.m1-016.compatibilityPromotion', 'M1-016 B26 allowance cannot be applied without the frozen notification/sync/support policy allowance')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1016_B26_SOURCE_SEMANTIC_SHA256) changes.push(describeChange('events', 'b26.m1-016.source', 'M1-016 B26 source is not the frozen 878f9eb static projection'));
  changes.push(...compareFrozenDescriptorSet('events', previous, current, M1016_B26_EXPECTED_CHANGE_DESCRIPTORS, 'b26.m1-016.change-descriptors', 'current B26 changes do not exactly match the frozen M1-016 descriptor set', compareM1016B26Descriptors));
  const expectedProjection = buildM1016B26ExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('events', 'b26.m1-016.projection', 'the approved static M1-016 B26 topics and routes cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1016_B26_EXPECTED_SEMANTIC_SHA256) changes.push(describeChange('events', 'b26.m1-016.expected-projection', 'the allowlisted M1-016 B26 projection does not match its frozen semantic digest'));
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) changes.push(describeChange('events', 'b26.m1-016.projection', 'current B26 policy differs from the explicit static-only M1-016 projection'));
  }
  return changes;
}

// M1-017 is deliberately bound to the accepted M1-016 handoff. The full
// semantic artifact digests and the generic descriptor-set digests are both
// frozen: the former rejects any unapproved nested addition, while the latter
// preserves a source-to-current explanation instead of granting a path-wide
// blanket allowance.
export const M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID = 'P1R-M1-017';
export const M1017_SOURCE_CONTRACT_BASELINE_REF = 'b1d79a09e266179988270e1832a1309a1cb4af4d';
export const M1017_IMMUTABLE_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const M1017_OPENAPI_SOURCE_SEMANTIC_SHA256 = 'd9e9f93e27e5e5249254d0433da7dd953d0cc9e6697da63def3ee037cb70255a';
export const M1017_EVENT_SOURCE_SEMANTIC_SHA256 = '6517444993e9e26fa09f2558fd9fb0bf4f24a12d78071ddf3e40a3f30db919b8';
export const M1017_B26_SOURCE_SEMANTIC_SHA256 = '6fa1b473ec91ab569d9be33f465e21651f20d372dd22d4ac25bae6fb10971120';
export const M1017_OPENAPI_EXPECTED_SEMANTIC_SHA256 = 'd40fff55a7a138d533fc536875396d34f05691ec08a63e6a86ff4f9cfff68a01';
export const M1017_EVENT_EXPECTED_SEMANTIC_SHA256 = '4a1357e308271533e66e25bceba4ccb164ee5c2d58652b642b252895028a8ac2';
export const M1017_B26_EXPECTED_SEMANTIC_SHA256 = 'b04c19851d17e02a0f5c2ca2221bfbc2d977d6f49cd92d0be7926398fe2a90a5';
export const M1017_OPENAPI_DESCRIPTOR_SET_SHA256 = '0e575628e9e1828c37d461c121c98d88ac63a138138d08a1538bbc4582913092';
export const M1017_EVENT_DESCRIPTOR_SET_SHA256 = 'c3fa4291254d7c83ec0b690c648fb86437fa72dac84f65744284caac7dd51767';
export const M1017_B26_DESCRIPTOR_SET_SHA256 = 'e72f5be7f21ef1c166dee360c582a8bd4dc92a66f809242fd0e4dcd95660d37b';
export const M1017_POLICY_SEMANTIC_SHA256 = '05c0eafc6577fdfd64b3313a4746eb380bfad554f2f61ca32e47b55c2ee41e53';
export const M1017_APPROVED_SOURCE_FILES_SEMANTIC_SHA256 = 'a0bd97212685c369bc42bea3b68387f17d1e6ac6d347458e7fba8be7445f4953';
export const M1017_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256 = '4cf0e4f0ad2b83c36843435b6eb67efdfd54d708b0da9d79e358f1995faa32b6';
export const M1017_B26_STATIC_POLICY_SEMANTIC_SHA256 = '607860dedc229e019e9dc6bf5c7e88511776b5e3c309fbb467318bd653b4e3bd';
export const M1017_PROMOTION_ALLOWANCE_KEYS = Object.freeze([
  'id', 'sourceContractBaseline', 'previousPromotion', 'previousPromotionContract',
  'immutableGovernanceBaseline', 'runtimeStatus', 'scope', 'promotionMode',
  'allowsHistoricalV1Promotion', 'allowsDualPublish', 'approvedSourceFiles',
  'requiredCompatibilityChecks', 'b26StaticPolicy',
]);

export function isValidM1017PromotionAllowance(allowance) {
  return isRecord(allowance)
    && stableGovernanceValue(Object.keys(allowance).sort()) === stableGovernanceValue([...M1017_PROMOTION_ALLOWANCE_KEYS].sort())
    && allowance.id === M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID
    && allowance.sourceContractBaseline === M1017_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID
    && allowance.previousPromotionContract === 'config/p1r-notification-sync-support-contract.v1.json'
    && allowance.immutableGovernanceBaseline === M1017_IMMUTABLE_GOVERNANCE_BASELINE_REF
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'M1017_OPENAPI_EVENT_GOVERNANCE_B26_STATIC_WITH_B1_B13_V1_HISTORICAL'
    && allowance.promotionMode === 'FUTURE_M1017_V2_ONLY'
    && allowance.allowsHistoricalV1Promotion === false
    && allowance.allowsDualPublish === false
    && stableGovernanceSha256(allowance.approvedSourceFiles) === M1017_APPROVED_SOURCE_FILES_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.requiredCompatibilityChecks) === M1017_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.b26StaticPolicy) === M1017_B26_STATIC_POLICY_SEMANTIC_SHA256;
}

export function compareM1017OpenApiDescriptors(previous, current) {
  return compareOpenApi(previous, current);
}

export function compareM1017EventDescriptors(previous, current) {
  return compareEvents(previous, current);
}

export function compareM1017B26Descriptors(previous, current) {
  return compareB26WorkflowGovernance(previous, current);
}

function compareM1017FrozenProjection({ kind, previous, current, allowance, sourceDigest, expectedDigest, descriptorDigest, descriptors }) {
  if (!isValidM1017PromotionAllowance(allowance)) {
    return [describeChange(kind, 'm1-017.compatibilityPromotion', 'M1-017 allowance is not the frozen privacy/analytics/audit policy')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== sourceDigest) {
    changes.push(describeChange(kind, 'm1-017.source', 'M1-017 source is not the accepted b1d79a0 M1-016 handoff'));
  }
  const actualDescriptors = descriptors(previous, current);
  if (stableGovernanceSha256(actualDescriptors) !== descriptorDigest) {
    changes.push(describeChange(kind, 'm1-017.change-descriptors', 'current changes do not exactly match the frozen M1-017 descriptor set'));
  }
  if (stableGovernanceSha256(current) !== expectedDigest) {
    changes.push(describeChange(kind, 'm1-017.projection', 'current artifact is not the exact frozen M1-017 semantic projection'));
  }
  return changes;
}

function compareM1017OpenApiPromotion(previous, current, allowance) {
  return compareM1017FrozenProjection({
    kind: 'openapi', previous, current, allowance,
    sourceDigest: M1017_OPENAPI_SOURCE_SEMANTIC_SHA256,
    expectedDigest: M1017_OPENAPI_EXPECTED_SEMANTIC_SHA256,
    descriptorDigest: M1017_OPENAPI_DESCRIPTOR_SET_SHA256,
    descriptors: compareM1017OpenApiDescriptors,
  });
}

function compareM1017EventPromotion(previous, current, allowance) {
  return compareM1017FrozenProjection({
    kind: 'events', previous, current, allowance,
    sourceDigest: M1017_EVENT_SOURCE_SEMANTIC_SHA256,
    expectedDigest: M1017_EVENT_EXPECTED_SEMANTIC_SHA256,
    descriptorDigest: M1017_EVENT_DESCRIPTOR_SET_SHA256,
    descriptors: compareM1017EventDescriptors,
  });
}

function compareM1017B26Promotion(previous, current, allowance) {
  return compareM1017FrozenProjection({
    kind: 'events', previous, current, allowance,
    sourceDigest: M1017_B26_SOURCE_SEMANTIC_SHA256,
    expectedDigest: M1017_B26_EXPECTED_SEMANTIC_SHA256,
    descriptorDigest: M1017_B26_DESCRIPTOR_SET_SHA256,
    descriptors: compareM1017B26Descriptors,
  });
}

// M1-018 starts from the accepted M1-017 evidence checkpoint.  It is a
// deliberately finite static promotion: exactly three new IAM-owned v2 facts
// plus their B26 routing are permitted.  B8 v1 credential/session facts stay
// historical and this allowance never establishes a runtime Kafka claim.
export const M1018_IAM_EVENT_PROMOTION_ID = 'P1R-M1-018';
export const M1018_SOURCE_CONTRACT_BASELINE_REF = '97497afe1f31703601d1491c8d47d00121c90089';
export const M1018_IMMUTABLE_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const M1018_OPENAPI_SOURCE_SEMANTIC_SHA256 = 'd40fff55a7a138d533fc536875396d34f05691ec08a63e6a86ff4f9cfff68a01';
export const M1018_EVENT_SOURCE_SEMANTIC_SHA256 = '4a1357e308271533e66e25bceba4ccb164ee5c2d58652b642b252895028a8ac2';
export const M1018_B26_SOURCE_SEMANTIC_SHA256 = 'b04c19851d17e02a0f5c2ca2221bfbc2d977d6f49cd92d0be7926398fe2a90a5';
export const M1018_OPENAPI_EXPECTED_SEMANTIC_SHA256 = 'a154f2004f06e5da096abea630855152fac9e87224ad48565a38e6010ab9416b';
export const M1018_EVENT_EXPECTED_SEMANTIC_SHA256 = '5dd1edfae663dd4fcc2975e6ec44e4272efae19ac049c4098bb1be8033ce1548';
export const M1018_B26_EXPECTED_SEMANTIC_SHA256 = 'fac58e090abb889fe9d9b5660b2727189c97987d2d7ae4ec9fdf82357b8ba5f0';
export const M1018_OPENAPI_DESCRIPTOR_SET_SHA256 = '2543b279c202ca73634a23a3ac3c359972896f54d0b36dba46674e9c08b26172';
export const M1018_EVENT_DESCRIPTOR_SET_SHA256 = 'c3fa4291254d7c83ec0b690c648fb86437fa72dac84f65744284caac7dd51767';
export const M1018_B26_DESCRIPTOR_SET_SHA256 = 'e72f5be7f21ef1c166dee360c582a8bd4dc92a66f809242fd0e4dcd95660d37b';
export const M1018_POLICY_SEMANTIC_SHA256 = '561946c69898a2a32c56c23d339581934c67e8f1f63f5412f81d8b14586184c0';
export const M1018_APPROVED_SOURCE_FILES_SEMANTIC_SHA256 = '54712fb28182adf2a04607d4df24b1aa24174acb3d7003c2ee0481bfbf43a607';
export const M1018_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256 = 'a9fcf98a1aa3f4f53f33b1bab7386bf072881480c72002703ee5422e37df3315';
export const M1018_B26_STATIC_POLICY_SEMANTIC_SHA256 = '607860dedc229e019e9dc6bf5c7e88511776b5e3c309fbb467318bd653b4e3bd';

// M1-018 also closes the shared API response contract on the already accepted
// 97497af OpenAPI checkpoint.  Keep this list at response/status granularity:
// copying an entire route or path would make an unrelated response change an
// implicit allowance.  The generated OpenAPI is still checked against the
// frozen semantic digest below, so changing any copied node fails closed.
export const M1018_OPENAPI_RESPONSE_PROJECTIONS = Object.freeze([
  ['GET', '/api/v1/games/catalog', '200'],
  ['POST', '/api/v1/games/sessions', '201'],
  ['GET', '/api/v1/games/sessions/{sessionId}', '200'],
  ['POST', '/api/v1/games/sessions/{sessionId}/events', '200'],
  ['POST', '/api/v1/games/sessions/{sessionId}/pause', '200'],
  ['POST', '/api/v1/games/sessions/{sessionId}/resume', '200'],
  ['POST', '/api/v1/games/sessions/{sessionId}/finish', '200'],
  ['GET', '/api/v1/social/rooms', '200'],
  ['GET', '/api/v1/social/rooms/{roomId}', '200'],
  ['POST', '/api/v1/social/rooms/{roomId}/join', '200'],
  ['POST', '/api/v1/social/rooms/{roomId}/leave', '200'],
  ['GET', '/api/v1/support/tickets', '200'],
  ['POST', '/api/v1/support/tickets', '201'],
  ['GET', '/api/v1/support/tickets/{ticketId}', '200'],
  ['POST', '/api/v1/support/tickets/{ticketId}/messages', '201'],
  ['POST', '/api/v1/assessment/placement/sessions', '201'],
  ['GET', '/api/v1/assessment/placement/sessions/{sessionId}', '200'],
  ['POST', '/api/v1/assessment/placement/sessions/{sessionId}/responses', '200'],
  ['POST', '/api/v1/assessment/placement/baselines/skip', '201'],
  ['GET', '/api/v1/assessment/placement/reports/{reportId}', '200'],
  ['GET', '/api/v1/learning/plans/current', '200'],
  ['GET', '/api/v1/learning/plans/current', '401'],
  ['GET', '/api/v1/learning/plans/current', '403'],
  ['GET', '/api/v1/learning/today', '200'],
  ['GET', '/api/v1/learning/today', '401'],
  ['GET', '/api/v1/learning/today', '403'],
  ['POST', '/api/v1/learning/plans/reorder', '200'],
  ['POST', '/api/v1/learning/plans/reorder', '400'],
  ['POST', '/api/v1/learning/plans/reorder', '401'],
  ['POST', '/api/v1/learning/plans/reorder', '403'],
  ['POST', '/api/v1/learning/plans/reorder', '409'],
  ['POST', '/api/v1/learning/tasks/{taskId}/complete', '200'],
  ['POST', '/api/v1/learning/tasks/{taskId}/complete', '400'],
  ['POST', '/api/v1/learning/tasks/{taskId}/complete', '401'],
  ['POST', '/api/v1/learning/tasks/{taskId}/complete', '403'],
  ['POST', '/api/v1/learning/tasks/{taskId}/complete', '404'],
  ['POST', '/api/v1/learning/tasks/{taskId}/complete', '409'],
  ['GET', '/api/v1/learning/repairs', '200'],
  ['GET', '/api/v1/learning/repairs', '401'],
  ['GET', '/api/v1/learning/repairs', '403'],
  ['GET', '/api/v1/learning/repairs/{repairId}', '200'],
  ['GET', '/api/v1/learning/repairs/{repairId}', '401'],
  ['GET', '/api/v1/learning/repairs/{repairId}', '403'],
  ['GET', '/api/v1/learning/repairs/{repairId}', '404'],
  ['GET', '/api/v1/learning/mastery', '200'],
  ['GET', '/api/v1/learning/mastery', '401'],
  ['GET', '/api/v1/learning/mastery', '403'],
  ['GET', '/api/v1/learning/reports/{reportType}', '200'],
  ['GET', '/api/v1/learning/reports/{reportType}', '401'],
  ['GET', '/api/v1/learning/reports/{reportType}', '403'],
  ['GET', '/api/v1/learning/reports/{reportType}', '404'],
  ['GET', '/api/v1/learning/sync/receipts', '401'],
  ['GET', '/api/v1/learning/sync/receipts', '403'],
  ['GET', '/api/v1/learning/sync/cursor', '401'],
  ['GET', '/api/v1/learning/sync/cursor', '403'],
  ['GET', '/api/v1/learning/sync/conflicts', '401'],
  ['GET', '/api/v1/learning/sync/conflicts', '403'],
  ['POST', '/api/v1/learning/sync/conflicts/{conflictId}/recovery', '401'],
  ['POST', '/api/v1/learning/sync/conflicts/{conflictId}/recovery', '403'],
  ['POST', '/api/v1/learning/sync/conflicts/{conflictId}/recovery', '409'],
  ['GET', '/api/v1/admin/ops/tickets/{ticketId}', '200'],
  ['POST', '/api/v1/admin/ops/tickets/{ticketId}/messages', '201'],
  ['POST', '/api/v1/admin/ops/tickets/{ticketId}/commands', '202'],
  ['POST', '/api/v1/privacy/exports', '202'],
  ['GET', '/api/v1/privacy/exports/{exportId}', '200'],
  ['POST', '/api/v1/privacy/exports/{exportId}/download', '200'],
  ['GET', '/api/v1/privacy/exports/{exportId}/receipt', '200'],
  ['POST', '/api/v1/iam/account-deletions', '202'],
  ['GET', '/api/v1/iam/account-deletions/{deletionRequestId}', '200'],
  ['POST', '/api/v1/iam/account-deletions/{deletionRequestId}/cancel', '200'],
  ['POST', '/api/v1/analytics/telemetry', '202'],
  ['POST', '/api/v1/analytics/telemetry', '400'],
  ['POST', '/api/v1/analytics/telemetry', '401'],
  ['POST', '/api/v1/analytics/telemetry', '403'],
  ['POST', '/api/v1/analytics/telemetry', '409'],
  ['POST', '/api/v1/analytics/telemetry', '429'],
]);
export const M1018_OPENAPI_SCHEMA_PROJECTIONS = Object.freeze([
  'B9ScheduledPublishTaskResponse',
]);
export const M1018_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ...M1018_OPENAPI_RESPONSE_PROJECTIONS.map(([method, route, status]) => [
    `${method} ${route}.responses.${status}`,
    'approved M1-018 API response projection changed',
  ]),
  ...M1018_OPENAPI_SCHEMA_PROJECTIONS.map((name) => [
    `components.schemas.${name}`,
    'approved M1-018 API response schema projection changed',
  ]),
]);
export const M1018_PROMOTION_ALLOWANCE_KEYS = Object.freeze([
  'id', 'sourceContractBaseline', 'previousPromotion', 'previousPromotionContract',
  'immutableGovernanceBaseline', 'runtimeStatus', 'scope', 'promotionMode',
  'allowsHistoricalV1Promotion', 'allowsDualPublish', 'approvedSourceFiles',
  'requiredCompatibilityChecks', 'b26StaticPolicy',
]);

export function isValidM1018PromotionAllowance(allowance) {
  return isRecord(allowance)
    && stableGovernanceValue(Object.keys(allowance).sort()) === stableGovernanceValue([...M1018_PROMOTION_ALLOWANCE_KEYS].sort())
    && allowance.id === M1018_IAM_EVENT_PROMOTION_ID
    && allowance.sourceContractBaseline === M1018_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID
    && allowance.previousPromotionContract === 'config/p1r-privacy-analytics-audit-contract.v1.json'
    && allowance.immutableGovernanceBaseline === M1018_IMMUTABLE_GOVERNANCE_BASELINE_REF
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'M1018_IAM_EVENT_GOVERNANCE_API_REPAIR_B26_STATIC_WITH_B8_V1_HISTORICAL'
    && allowance.promotionMode === 'FUTURE_M1018_V2_ONLY'
    && allowance.allowsHistoricalV1Promotion === false
    && allowance.allowsDualPublish === false
    && stableGovernanceSha256(allowance.approvedSourceFiles) === M1018_APPROVED_SOURCE_FILES_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.requiredCompatibilityChecks) === M1018_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256
    && stableGovernanceSha256(allowance.b26StaticPolicy) === M1018_B26_STATIC_POLICY_SEMANTIC_SHA256;
}

function m1018OpenApiResponse(previous, route, method, status) {
  return previous?.paths?.[route]?.[method.toLowerCase()]?.responses?.[status];
}

function copyM1018OpenApiResponse(expected, approved, [method, route, status]) {
  const previousResponse = m1018OpenApiResponse(expected, route, method, status);
  const approvedResponse = m1018OpenApiResponse(approved, route, method, status);
  if (!isRecord(previousResponse) || !isRecord(approvedResponse)) return false;
  expected.paths[route][method.toLowerCase()].responses[status] = structuredClone(approvedResponse);
  return true;
}

/**
 * Rebuild the one approved M1-018 OpenAPI projection from the immutable
 * 97497af checkpoint.  API repair is intentionally expressed as exact
 * response/status and schema nodes; no route, path or whole component is
 * implicitly promoted.  The fixed semantic digest below also binds every
 * nested header, response reference and envelope detail.
 */
export function buildM1018OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM1018PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M1018_OPENAPI_SOURCE_SEMANTIC_SHA256
    || !isRecord(previous.paths) || !isRecord(approved.paths)
    || !isRecord(previous.components?.schemas) || !isRecord(approved.components?.schemas)) return undefined;
  const expected = structuredClone(previous);
  if (!M1018_OPENAPI_RESPONSE_PROJECTIONS.every((projection) => copyM1018OpenApiResponse(expected, approved, projection))) return undefined;
  for (const name of M1018_OPENAPI_SCHEMA_PROJECTIONS) {
    if (!isRecord(approved.components.schemas[name])) return undefined;
    expected.components.schemas[name] = structuredClone(approved.components.schemas[name]);
  }
  return expected;
}

export function compareM1018OpenApiDescriptors(previous, current) {
  const changes = [];
  for (const [method, route, status] of M1018_OPENAPI_RESPONSE_PROJECTIONS) {
    if (stableGovernanceValue(m1018OpenApiResponse(previous, route, method, status))
      !== stableGovernanceValue(m1018OpenApiResponse(current, route, method, status))) {
      changes.push(describeChange(
        'openapi',
        `${method} ${route}.responses.${status}`,
        'approved M1-018 API response projection changed',
      ));
    }
  }
  for (const name of M1018_OPENAPI_SCHEMA_PROJECTIONS) {
    if (stableGovernanceValue(previous?.components?.schemas?.[name])
      !== stableGovernanceValue(current?.components?.schemas?.[name])) {
      changes.push(describeChange(
        'openapi',
        `components.schemas.${name}`,
        'approved M1-018 API response schema projection changed',
      ));
    }
  }
  return changes;
}

export function compareM1018EventDescriptors(previous, current) {
  return compareEvents(previous, current);
}

export function compareM1018B26Descriptors(previous, current) {
  return compareB26WorkflowGovernance(previous, current);
}

function compareM1018FrozenProjection({ kind, previous, current, allowance, sourceDigest, expectedDigest, descriptorDigest, descriptors }) {
  if (!isValidM1018PromotionAllowance(allowance)) {
    return [describeChange(kind, 'm1-018.compatibilityPromotion', 'M1-018 allowance is not the frozen IAM v2 static-governance policy')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== sourceDigest) {
    changes.push(describeChange(kind, 'm1-018.source', 'M1-018 source is not the accepted 97497af M1-017 evidence handoff'));
  }
  const actualDescriptors = descriptors(previous, current);
  if (stableGovernanceSha256(actualDescriptors) !== descriptorDigest) {
    changes.push(describeChange(kind, 'm1-018.change-descriptors', 'current changes do not exactly match the frozen M1-018 descriptor set'));
  }
  if (stableGovernanceSha256(current) !== expectedDigest) {
    changes.push(describeChange(kind, 'm1-018.projection', 'current artifact is not the exact frozen M1-018 IAM v2 static projection'));
  }
  return changes;
}

function compareM1018OpenApiPromotion(previous, current, allowance) {
  if (!isValidM1018PromotionAllowance(allowance)) {
    return [describeChange('openapi', 'm1-018.openapiPromotion', 'M1-018 allowance is not the frozen IAM/API static-governance policy')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M1018_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm1-018.source', 'M1-018 OpenAPI source is not the frozen 97497af checkpoint'));
  }
  const actualDescriptors = compareM1018OpenApiDescriptors(previous, current);
  if (stableGovernanceSha256(actualDescriptors) !== M1018_OPENAPI_DESCRIPTOR_SET_SHA256) {
    changes.push(describeChange('openapi', 'm1-018.change-descriptors', 'current OpenAPI changes do not exactly match the frozen M1-018 API descriptor set'));
  }
  const expectedProjection = buildM1018OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('openapi', 'm1-018.projection', 'the approved M1-018 API projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M1018_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('openapi', 'm1-018.expected-projection', 'the allowlisted M1-018 API projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('openapi', 'm1-018.projection', 'current OpenAPI is not the unique frozen-source M1-018 API projection'));
    }
  }
  return changes;
}

function compareM1018EventPromotion(previous, current, allowance) {
  return compareM1018FrozenProjection({
    kind: 'events', previous, current, allowance,
    sourceDigest: M1018_EVENT_SOURCE_SEMANTIC_SHA256,
    expectedDigest: M1018_EVENT_EXPECTED_SEMANTIC_SHA256,
    descriptorDigest: M1018_EVENT_DESCRIPTOR_SET_SHA256,
    descriptors: compareM1018EventDescriptors,
  });
}

function compareM1018B26Promotion(previous, current, allowance) {
  return compareM1018FrozenProjection({
    kind: 'events', previous, current, allowance,
    sourceDigest: M1018_B26_SOURCE_SEMANTIC_SHA256,
    expectedDigest: M1018_B26_EXPECTED_SEMANTIC_SHA256,
    descriptorDigest: M1018_B26_DESCRIPTOR_SET_SHA256,
    descriptors: compareM1018B26Descriptors,
  });
}

// M2-001 is intentionally narrower than the M1 contract promotions: it
// changes no public request/response wire shape.  It promotes one complete
// Gateway root extension from the accepted M1-018 checkpoint so the finite
// execution-target table cannot be treated as an unreviewed OpenAPI drift.
// The entire extension is copied from the approved artifact and is bound by
// both a root digest and the full OpenAPI digest; no field-level wildcard or
// fallback is allowed.
export const M2001_GATEWAY_EXECUTION_TARGET_PROMOTION_ID = 'P1R-M2-001';
export const M2001_SOURCE_CONTRACT_BASELINE_REF = '66246d5b4a68a988a9af4ece68a446640b123812';
export const M2001_OPENAPI_SOURCE_SEMANTIC_SHA256 = 'a154f2004f06e5da096abea630855152fac9e87224ad48565a38e6010ab9416b';
export const M2001_GATEWAY_ROOT_SEMANTIC_SHA256 = '3ab6f617f927da7ee0b35ba86d2e7aec90d671a4226fde4bf2ca6044b423bb25';
export const M2001_EXECUTION_TARGET_POLICY_SEMANTIC_SHA256 = '4cfdcf2b40b444aaa8b114e87ef1025509cd71e4557998cb2f93e3b150b4c69d';
export const M2001_OPENAPI_EXPECTED_SEMANTIC_SHA256 = '2e3555a30835048957f5823dd4fec16d1e6562d81e9f185cf0dccdbe9dc77d9d';
export const M2001_OPENAPI_ROOT_EXTENSION = 'x-p1r-gateway-boundary';
export const M2001_PROMOTION_ALLOWANCE_KEYS = Object.freeze([
  'id',
  'sourceContractBaseline',
  'previousPromotion',
  'runtimeStatus',
  'scope',
  'rootExtension',
]);
export const M2001_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS = Object.freeze([
  ['x-p1r-gateway-boundary', 'approved M2-001 Gateway execution-target root extension changed'],
]);
export const M2001_OPENAPI_DESCRIPTOR_SET_SHA256 = stableGovernanceSha256(M2001_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS.map(([location, reason]) => (
  describeChange('openapi', location, reason)
)));

export function isValidM2001PromotionAllowance(allowance) {
  return isRecord(allowance)
    && stableGovernanceValue(Object.keys(allowance).sort()) === stableGovernanceValue([...M2001_PROMOTION_ALLOWANCE_KEYS].sort())
    && allowance.id === M2001_GATEWAY_EXECUTION_TARGET_PROMOTION_ID
    && allowance.sourceContractBaseline === M2001_SOURCE_CONTRACT_BASELINE_REF
    && allowance.previousPromotion === M1018_IAM_EVENT_PROMOTION_ID
    && allowance.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
    && allowance.scope === 'OPENAPI_GATEWAY_EXECUTION_TARGET_ROOT_EXTENSION_ONLY'
    && allowance.rootExtension === M2001_OPENAPI_ROOT_EXTENSION;
}

/**
 * Rebuild the one permitted M2-001 projection from the accepted M1-018
 * OpenAPI checkpoint.  M2-001 owns the Gateway execution table only; all
 * paths, schemas, tags and every other root extension remain byte-for-byte
 * equivalent under stable semantic comparison.
 */
export function buildM2001OpenApiExpectedProjection(previous, approved, allowance) {
  if (!isRecord(previous) || !isRecord(approved) || !isValidM2001PromotionAllowance(allowance)
    || stableGovernanceSha256(previous) !== M2001_OPENAPI_SOURCE_SEMANTIC_SHA256
    || !isRecord(previous[M2001_OPENAPI_ROOT_EXTENSION])
    || !isRecord(approved[M2001_OPENAPI_ROOT_EXTENSION])) return undefined;
  const expected = structuredClone(previous);
  expected[M2001_OPENAPI_ROOT_EXTENSION] = structuredClone(approved[M2001_OPENAPI_ROOT_EXTENSION]);
  return expected;
}

export function compareM2001OpenApiDescriptors(previous, current) {
  if (stableGovernanceValue(previous?.[M2001_OPENAPI_ROOT_EXTENSION])
    === stableGovernanceValue(current?.[M2001_OPENAPI_ROOT_EXTENSION])) return [];
  return [describeChange(
    'openapi',
    M2001_OPENAPI_ROOT_EXTENSION,
    'approved M2-001 Gateway execution-target root extension changed',
  )];
}

function compareM2001OpenApiPromotion(previous, current, allowance) {
  if (!isValidM2001PromotionAllowance(allowance)) {
    return [describeChange('openapi', 'm2-001.compatibilityPromotion', 'M2-001 allowance is not the frozen Gateway execution-target root-extension policy')];
  }
  const changes = [];
  if (stableGovernanceSha256(previous) !== M2001_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm2-001.source', 'M2-001 OpenAPI source is not the accepted 66246d5 M1-018 checkpoint'));
  }
  const actualDescriptors = compareM2001OpenApiDescriptors(previous, current);
  if (stableGovernanceSha256(actualDescriptors) !== M2001_OPENAPI_DESCRIPTOR_SET_SHA256) {
    changes.push(describeChange('openapi', 'm2-001.change-descriptors', 'current OpenAPI changes do not exactly match the frozen M2-001 Gateway root-extension descriptor set'));
  }
  const gatewayRoot = current?.[M2001_OPENAPI_ROOT_EXTENSION];
  if (!isRecord(gatewayRoot) || stableGovernanceSha256(gatewayRoot) !== M2001_GATEWAY_ROOT_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm2-001.gateway-root', 'Gateway boundary root extension is not the frozen M2-001 execution-target projection'));
  }
  const executionTargetPolicy = gatewayRoot?.executionTargetPolicy;
  if (!isRecord(executionTargetPolicy)
    || stableGovernanceSha256(executionTargetPolicy) !== M2001_EXECUTION_TARGET_POLICY_SEMANTIC_SHA256) {
    changes.push(describeChange('openapi', 'm2-001.execution-target-policy', 'Gateway execution-target policy is not the frozen M2-001 policy projection'));
  }
  const expectedProjection = buildM2001OpenApiExpectedProjection(previous, current, allowance);
  if (expectedProjection === undefined) {
    changes.push(describeChange('openapi', 'm2-001.projection', 'the approved M2-001 Gateway execution-target projection cannot be constructed from the frozen source'));
  } else {
    if (stableGovernanceSha256(expectedProjection) !== M2001_OPENAPI_EXPECTED_SEMANTIC_SHA256) {
      changes.push(describeChange('openapi', 'm2-001.expected-projection', 'the allowlisted M2-001 Gateway execution-target projection does not match its frozen semantic digest'));
    }
    if (stableGovernanceValue(expectedProjection) !== stableGovernanceValue(current)) {
      changes.push(describeChange('openapi', 'm2-001.projection', 'current OpenAPI is not the unique frozen-source M2-001 Gateway execution-target projection'));
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
  if (allowance?.id === M1018_IAM_EVENT_PROMOTION_ID) {
    return compareM1018B26Promotion(governanceBaseline, current, allowance);
  }
  if (allowance?.id === M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID) {
    return compareM1017B26Promotion(governanceBaseline, current, allowance);
  }
  if (allowance?.id === M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID) {
    return compareM1016B26Promotion(governanceBaseline, current, allowance);
  }
  if (allowance?.id === M1015_COMMERCE_PROMOTION_ID) {
    return compareM1015B26Promotion(governanceBaseline, current, allowance);
  }
  if (allowance?.id === M1014_GAMIFICATION_SOCIAL_PROMOTION_ID) {
    return compareM1014B26Promotion(governanceBaseline, current, allowance);
  }
  if (allowance?.id === M1013_LEARNING_LOOP_PROMOTION_ID) {
    return compareM1013B26Promotion(governanceBaseline, current, allowance);
  }
  if (allowance?.id === M1012_PLACEMENT_PROMOTION_ID) {
    return compareM1012B26Promotion(governanceBaseline, current, allowance);
  }
  if (allowance?.id === M1011_LEARNER_PLANNING_PROMOTION_ID) {
    return compareM1011B26Promotion(governanceBaseline, current, allowance);
  }
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
  if (allowance?.id === M1018_IAM_EVENT_PROMOTION_ID) {
    return compareM1018EventPromotion(previous, current, allowance);
  }
  if (allowance?.id === M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID) {
    return compareM1017EventPromotion(previous, current, allowance);
  }
  if (allowance?.id === M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID) {
    return compareM1016EventPromotion(previous, current, allowance);
  }
  if (allowance?.id === M1015_COMMERCE_PROMOTION_ID) {
    return compareM1015EventPromotion(previous, current, allowance);
  }
  if (allowance?.id === M1014_GAMIFICATION_SOCIAL_PROMOTION_ID) {
    return compareM1014EventPromotion(previous, current, allowance);
  }
  if (allowance?.id === M1013_LEARNING_LOOP_PROMOTION_ID) {
    return compareM1013EventPromotion(previous, current, allowance);
  }
  if (allowance?.id === M1012_PLACEMENT_PROMOTION_ID) {
    return compareM1012EventPromotion(previous, current, allowance);
  }
  if (allowance?.id === M1011_LEARNER_PLANNING_PROMOTION_ID) {
    return compareM1011EventPromotion(previous, current, allowance);
  }
  if (allowance?.id === M1010_ASSESSMENT_PROMOTION_ID) {
    return compareM1010EventPromotion(previous, current, allowance);
  }
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
    if (allowance?.id === M2001_GATEWAY_EXECUTION_TARGET_PROMOTION_ID) {
      return compareM2001OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1018_IAM_EVENT_PROMOTION_ID) {
      return compareM1018OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID) {
      return compareM1017OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID) {
      return compareM1016OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1015_COMMERCE_PROMOTION_ID) {
      return compareM1015OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1014_GAMIFICATION_SOCIAL_PROMOTION_ID) {
      return compareM1014OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1013_LEARNING_LOOP_PROMOTION_ID) {
      return compareM1013OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1012_PLACEMENT_PROMOTION_ID) {
      return compareM1012OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1011_LEARNER_PLANNING_PROMOTION_ID) {
      return compareM1011OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1010_ASSESSMENT_PROMOTION_ID) {
      return compareM1010OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1008_CONTENT_PROMOTION_ID) {
      return compareM1008OpenApiPromotion(previous, current, allowance);
    }
    if (allowance?.id === M1009_MEDIA_PROMOTION_ID) {
      return compareM1009OpenApiPromotion(previous, current, allowance);
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
