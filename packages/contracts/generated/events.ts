/* eslint-disable */
// GENERATED FILE. Source: packages/contracts/events/v1/catalog.json
// Run node scripts/contracts/generate-contracts.mjs after changing the source.

/** Contract identity of the shared event envelope definition; event.schema remains event-specific. */
export const platformEventEnvelopeContractSchema = "platform.event.v1" as const;

export interface PlatformEventEnvelope<TPayload, TEventSchema extends string = string> {
  eventId: string;
  eventName: string;
  schema: TEventSchema;
  version: number;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string;
  actorId: string;
  traceId: string;
  requestId: string;
  schemaVersion?: TEventSchema;
  dedupeKey?: string;
  clientEventId?: string;
  contentVersionId?: number;
  payload: TPayload;
}

/**
 * Generated from the contract source.
 */
export type LearningSrsBatchCreated = { userId: number; scheduleSnapshotId: number; localDate: string; rulesVersion: string; itemCount: number; };

/**
 * Generated from the contract source.
 */
export type VocabularyReviewAccepted = { reviewEventId: number; userId: number; srsStateId: number; stateVersion: number; effectiveQuality: number; riskDecision: "ALLOW"; itemType?: "VOCAB" | "PHRASE" | "EXPRESSION"; };

/**
 * Generated from the contract source.
 */
export type VocabularySrsStateChanged = { srsStateId: number; itemType: "VOCAB" | "PHRASE" | "EXPRESSION"; targetId: number; before: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; after: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; algorithmVersion: string; };

/**
 * Generated from the contract source.
 */
export type AssessmentAnswerScored = { attemptId: number; userId: number; exerciseId: number; questionId: number; contentVersionId?: number; scoringStatus: "SCORED" | "PENDING_REVIEW" | "REJECTED"; scoreBucket: "ZERO" | "LOW" | "MEDIUM" | "HIGH" | "FULL" | "WITHHELD"; isCorrect?: boolean | null; errorCategory?: string; };

/**
 * Generated from the contract source.
 */
export type MasteryStateChanged = { userId: number; itemType: "VOCAB" | "PHRASE" | "EXPRESSION" | "GRAMMAR" | "SENTENCE" | "EXERCISE"; itemId: number; from: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; to: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; reason: string; verificationStage?: "D0" | "D1" | "D7" | "SRS"; };

/**
 * Generated from the contract source.
 */
export type LearningTaskCompleted = { userId: number; taskId: number; taskType: string; completedAt: string; completionVersion: number; };

/**
 * Generated from the contract source.
 */
export type CmsContentSubmitted = { contentId: number; contentVersionId: number; contentType: string; contentStatus: "IN_REVIEW"; reviewStage?: "FIRST_REVIEW" | "FINAL_REVIEW"; };

/**
 * Generated from the contract source.
 */
export type CmsReviewDecided = { contentId: number; contentVersionId: number; reviewStage: "FIRST_REVIEW" | "FINAL_REVIEW"; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewVersion: number; reasonCode?: string; };

/**
 * Generated from the contract source.
 */
export type CmsContentPublished = { contentId: number; contentVersionId: number; contentType: string; publishedAt: string; contentStatus: "PUBLISHED"; };

/**
 * Generated from the contract source.
 */
export type CmsContentRolledBack = { contentId: number; contentVersionId: number; rollbackToVersionId: number; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type CommerceOrderPaid = { orderId: number; userId: number; entitlementId?: number; amountMinor: number; currency: "CNY"; paymentChannel: "WECHAT" | "ALIPAY" | "APPLE_IAP" | "MANUAL"; };

/**
 * Generated from the contract source.
 */
export type CommerceEntitlementRevoked = { entitlementId: number; userId: number; reasonCode: string; revokedAt: string; status: "REVOKED"; };

/**
 * Generated from the contract source.
 */
export type CommerceSubscriptionChanged = { entitlementId: number; userId: number; fromStatus: "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED" | "FROZEN"; toStatus: "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED" | "FROZEN"; source: "PURCHASE" | "RENEWAL" | "REFUND" | "EXPIRY" | "RISK" | "ADMIN"; };

/**
 * Generated from the contract source.
 */
export type NotificationCreated = { notificationId: number; userId: number; category: "LEARNING" | "REMINDER" | "SECURITY" | "TRANSACTION" | "SYSTEM"; templateCode: string; dedupeKey: string; priority: "NORMAL" | "IMPORTANT" | "CRITICAL"; expiresAt?: string; };

/**
 * Generated from the contract source.
 */
export type NotificationRead = { notificationId: number; userId: number; readAt: string; };

/**
 * Generated from the contract source.
 */
export type SyncLearningCheckpointSaved = { clientEventId: string; userId: number; deviceId: string; entityType: "LEARNING_SESSION" | "ASSESSMENT_SESSION" | "MEDIA_PROGRESS"; entityId: string; entityVersion: number; stepIndex: number; baseCursor: string; offline: boolean; };

/**
 * Generated from the contract source.
 */
export type SyncConflictDetected = { userId: number; clientEventId: string; entityType: string; entityId: string; conflictType: "VERSION" | "CURSOR_EXPIRED" | "CONTENT_VERSION" | "OWNERSHIP"; serverVersion: number; clientVersion: number; resolution: "SERVER_WINS" | "CLIENT_RETRY" | "MANUAL_REVIEW"; };

/**
 * Generated from the contract source.
 */
export type SyncCursorAdvanced = { userId: number; deviceId: string; cursor: string; acceptedCount: number; rejectedCount: number; };

/**
 * Generated from the contract source.
 */
export type AuthSessionRevoked = { sessionId: string; userId: number; deviceId: string; reasonCode: "LOGOUT" | "KICKED" | "REUSE_DETECTED" | "RISK_FREEZE" | "ACCOUNT_DELETED" | "ADMIN"; revokedAt: string; };

/**
 * Generated from the contract source.
 */
export type AssessmentItemSubmitted = { attemptId: number; userId: number; questionId: number; contentVersionId: number; idempotencyKeyHash: string; submittedAt: string; };

/**
 * Generated from the contract source.
 */
export type AuthDeviceKicked = { sessionId: string; userId: number; deviceId: string; reasonCode: "KICKED" | "RISK_FREEZE" | "ADMIN"; revokedAt: string; };

/**
 * Generated from the contract source.
 */
export type PrivacyExportRequested = { exportId: string; userId: number; policyName: "learner-self"; requestedAt: string; };

/**
 * Generated from the contract source.
 */
export type PrivacyExportCompleted = { exportId: string; userId: number; recordCount: number; outputDigest: string; completedAt: string; };

/**
 * Generated from the contract source.
 */
export type AssessmentStreamBuilt = { sessionId: string; userId: number; streamRevision: string; algorithmVersion: "ASM-DS-1"; seedHash: string; requestedQuota: Record<string, never>; actualQuota: Record<string, never>; degraded: boolean; candidateSnapshotAt: string; };

/**
 * Generated from the contract source.
 */
export type AssessmentAnswerSubmitted = { submissionId: number; sessionId: string; exerciseId: number; questionId: number; revision: number; scoringStatus: string; submittedAt: string; };

/**
 * Generated from the contract source.
 */
export type MasteryVerificationStateChanged = { transitionId: string; mistakeId: number; itemId: number; fromMistakeStatus: string; toMistakeStatus: string; masteryStatus: string; stage: "D0" | "D1" | "D7"; ruleVersion: string; changedAt: string; };

/**
 * Generated from the contract source.
 */
export type ExamSessionStateChanged = { transitionId: string; sessionId: string; from: string; to: string; reason: string; serverOccurredAt: string; };

/**
 * Generated from the contract source.
 */
export type ExamAntiCheatRecorded = { eventId: string; sessionId: string; eventType: string; severity: "INFO" | "WARNING" | "SUSPECTED_REVIEW"; sequence: number; deviceHash: string; ruleVersion: string; recordedAt: string; };

/**
 * Generated from the contract source.
 */
export type ReportGenerated = { reportId: number; reportType: "EXAM_DIAGNOSTIC" | "DAILY" | "WEEKLY"; calculationVersion: string; status: "READY" | "PARTIAL" | "FAILED"; generatedAt: string; };

/**
 * Generated from the contract source.
 */
export type VocabularyReviewFiltered = { reviewEventId: number; userId: number; itemType: "VOCAB" | "PHRASE" | "CHUNK" | "EXPRESSION"; riskDecision: "FILTER" | "REVIEW"; ruleCode: string; };

/**
 * Generated from the contract source.
 */
export type VocabularyExpressionCreated = { expressionId: number; userId: number; sourceType: string; textLength: number; hasAudio: boolean; };

/**
 * Generated from the contract source.
 */
export type GrammarPracticeCompleted = { sessionId: string; userId: number; grammarPointId: number; ruleVersion: string; completedCount: number; mistakeCount: number; reviewSignal?: "NONE" | "SRS_REVIEW"; };

/**
 * Generated from the contract source.
 */
export type WritingEvaluationCompleted = { submissionId: string; userId: number; promptId: number; ruleVersion: string; score: number; matchedPointCount?: number; aiScoringAvailable: false; reviewSignal?: "NONE" | "SRS_REVIEW"; };

/**
 * Generated from the contract source.
 */
export type ListeningDictationSubmitted = { attemptId: string; userId: number; materialId: number; segmentId: string; mode: string; score: number; mismatchCount?: number; contentVersionId: number; reviewSignal?: "NONE" | "VOCAB_REVIEW"; };

/**
 * Generated from the contract source.
 */
export type ReadingProgressUpdated = { progressId: string; userId: number; articleId: number; contentVersionId: number; positionVersion: number; progressPercent: number; blockId?: string; };

/**
 * Generated from the contract source.
 */
export type SpeakingSelfRatingSubmitted = { recordingId: string; userId: number; rating: string; tagCount?: number; durationMs?: number; aiScoringAvailable: false; reviewSignal?: "NONE" | "SRS_REVIEW"; };

/**
 * Generated from the contract source.
 */
export type OfflineSyncApplied = { clientBatchId: string; userId: number; acceptedCount: number; conflictCount: number; nextCursor: string; resolution?: "SERVER_WINS" | "LOCAL_RETRY" | "MERGED"; };

/**
 * Generated from the contract source.
 */
export type GrammarMasteryUpdated = { grammarPointId: number; userId: number; dimensions?: { [key: string]: number; }; overall: number; masteryLevel: string; ruleVersion: string; };

/**
 * Generated from the contract source.
 */
export type ListeningProgressSaved = { sessionId: string; userId: number; materialId: number; positionMs: number; positionVersion: number; };

/**
 * Generated from the contract source.
 */
export type ShadowingProgressed = { shadowingSessionId: string; userId: number; attemptCount: number; positionMs: number; aiScoringAvailable: false; };

/**
 * Generated from the contract source.
 */
export type OfflinePackageSynced = { packageId: number; userId: number; assetCount: number; readyCount: number; failedCount?: number; };

/**
 * Generated from the contract source.
 */
export type B4FactPayload = { aggregateId: string; userId: number; ruleVersion: string; status: string; sourceType?: string; deltaXp?: number; deltaCoins?: number; serverScore?: number; serverDurationSeconds?: number; duplicateConverted?: boolean; versionNo?: number; };

/**
 * Generated from the contract source.
 */
export type B5FactPayload = { aggregateId: string; userId?: number; status: string; ruleVersion: string; amountMinor?: number; currency?: string; provider?: string; contentVersionId?: string; reasonCode?: string; decisionCode?: string; ttlSeconds?: number; rolloutPercent?: number; discrepancyCode?: string; redacted?: boolean; };

/**
 * Generated from the contract source.
 */
export type B6FactPayload = { aggregateId: string; status: string; resultCode: string; ruleVersion: string; platformCode?: string; buildVersion?: string; sourceRevision?: string; passedCount?: number; failedCount?: number; criticalCount?: number; highCount?: number; duplicateWriteCount?: number; lostWriteCount?: number; rtoSeconds?: number; rpoSeconds?: number; gateDecision?: string; evidenceRef?: string; };

/**
 * Generated from the contract source.
 */
export type AuthPrincipalMapped = { principalId: string; mappingStatus: "CREATED" | "LINKED" | "REJECTED"; adultGateStatus: "PENDING" | "APPROVED" | "REJECTED"; mappedAt: string; };

/**
 * Generated from the contract source.
 */
export type AuthSessionRotated = { sessionId: string; rotationId: string; deviceId: string; sessionGeneration: number; rotatedAt: string; };

/**
 * Generated from the contract source.
 */
export type AuthSessionReplayDetected = { sessionId: string; deviceId: string; detectionId: string; detectionCode: "REFRESH_REUSE"; revocationStatus: "SESSION_REVOKED" | "PENDING_REVIEW"; detectedAt: string; };

/**
 * Generated from the contract source.
 */
export type AuthDeviceRevoked = { deviceId: string; sessionId: string; reasonCode: "LOGOUT" | "KICKED" | "REPLAY_DETECTED" | "RISK_FREEZE" | "ADMIN"; revokedAt: string; };

/**
 * Generated from the contract source.
 */
export type AuthConsentUpdated = { principalId: string; consentType: "TERMS" | "PRIVACY" | "ADULT_LEARNING" | "PRODUCT_ANALYTICS"; consentVersion: string; decision: "ACCEPTED" | "WITHDRAWN"; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type AuthAdultGateRejected = { decisionId: string; reasonCode: "UNDER_ADULT_THRESHOLD" | "EVIDENCE_REQUIRED" | "PHASE_DISABLED"; policyVersion: string; rejectedAt: string; };

/**
 * Generated from the contract source.
 */
export type IamPolicyVersionChanged = { policyName: string; previousVersion: string; currentVersion: string; activationMode: "SCHEDULED" | "IMMEDIATE" | "ROLLBACK"; changedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9LearnerProfileUpdated = { tenantId: string; principalId: string; profileVersion: number; changedFieldCodes: readonly [string, ...Array<string>]; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9LearnerTargetUpdated = { tenantId: string; principalId: string; targetId: number; targetVersion: number; goalCode: "FOUNDATION" | "COLLEGE_CET" | "POSTGRADUATE_ENGLISH" | "WORKPLACE_DAILY"; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; dailyQuotaMinutes: 5 | 15 | 30 | 45; profileVersion: number; preferenceVersion: number; timezone: string; weeklyStudyDays: readonly [number] | readonly [number, number] | readonly [number, number, number] | readonly [number, number, number, number] | readonly [number, number, number, number, number] | readonly [number, number, number, number, number, number] | readonly [number, number, number, number, number, number, number]; contentLocale: string; goalCatalogVersion: string; targetSnapshotDigest: string; inputFactWatermark: string; sourceEventId: string; rootEventId: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9LearnerFirstDayProjected = { tenantId: string; principalId: string; profileVersion?: number; targetVersion?: number; preferenceVersion?: number; planningInputPinId?: string; planningInputVersion?: number; planningInputDigest?: string; planVersion?: number; projectionVersion: number; contentEpoch: number; readiness: "NOT_READY" | "PROCESSING" | "READY" | "DEGRADED"; taskCount: number; inputFactWatermark?: string; sourceEventId?: string; rootEventId?: string; failureCode?: "NONE" | "PROFILE_INCOMPLETE" | "TARGET_INCOMPLETE" | "PLAN_PENDING" | "PLAN_FAILED" | "CONTENT_UNAVAILABLE" | "RIGHTS_DENIED" | "DEPENDENCY_UNAVAILABLE" | "POLICY_DENIED" | "MANUAL_RECOVERY_REQUIRED"; recoveryTaskId?: string; projectedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentVersionSubmitted = { tenantId: string; contentCode: string; contentType: "COURSE" | "COURSE_UNIT" | "VOCABULARY" | "PHRASE" | "GRAMMAR" | "SENTENCE" | "QUESTION"; contentVersionId: number; versionNumber: number; stateVersion: number; submittedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentVersionReviewed = { tenantId: string; contentCode: string; contentVersionId: number; versionNumber: number; contentHash: string; stateVersion: number; commandId: string; auditId: string; reviewStage: "FIRST_REVIEW" | "FINAL_REVIEW"; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewVersion: number; reviewedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentVersionPublished = { tenantId: string; contentCode: string; contentType: "COURSE" | "COURSE_UNIT" | "VOCABULARY" | "PHRASE" | "GRAMMAR" | "SENTENCE" | "QUESTION"; contentVersionId: number; versionNumber: number; projectionKey: string; projectionVersion: number; contentEpoch: number; publicFieldSet: "PUBLIC_V1"; publishedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentVersionUnpublished = { tenantId: string; contentCode: string; contentVersionId: number; projectionKey: string; contentEpoch: number; reasonCode: string; unpublishedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentVersionRolledBack = { tenantId: string; contentCode: string; fromVersionId: number; targetVersionId: number; projectionKey: string; contentEpoch: number; rolledBackAt: string; };

/**
 * Generated from the contract source.
 */
export type B9PublicProjectionInvalidated = { tenantId: string; projectionKey: string; contentCode: string; contentVersionId?: number; contentEpoch: number; invalidationScope: "CONTENT" | "VERSION" | "SITE" | "MANIFEST" | "GLOBAL"; reasonCode: string; cacheTag?: string; invalidatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentAttemptSubmitted = { tenantId: string; principalId: string; attemptId: string; sessionId: string; contentVersionId: number; contentSnapshotId?: string; contentEpoch: number; snapshotId: string; snapshotHash: string; pin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; attemptVersion: number; submissionId: string; submissionDigest: string; itemCount: number; answerRuleSetVersion: string; answerRuleVersion: string; ruleDigest: string; completionRuleVersion: string; gradingRuleVersion?: string; submittedAt: string; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentAttemptAssessed = { tenantId: string; principalId: string; attemptId: string; sessionId: string; contentVersionId: number; contentSnapshotId?: string; contentEpoch: number; snapshotId: string; snapshotHash: string; pin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; attemptVersion: number; submissionId: string; submissionDigest: string; answerRuleSetVersion: string; answerRuleVersion: string; ruleDigest: string; completionRuleVersion: string; assessmentVersion: string; reportId: string; reportVersion: number; reportRuleVersion: string; reportStatus: "READY" | "PARTIAL" | "FAILED"; reportDigest: string; asOf: string; assessmentFactWatermark: string; outcomeKind: "OBJECTIVE"; objectiveNumerator: number; objectiveDenominator: number; scoreBucket: "ZERO" | "PARTIAL" | "FULL"; errorCategory: "NONE" | "CHOICE" | "MATCHING" | "ORDERING" | "CLOZE" | "TEXT" | "CONTENT" | "RULE"; reasonTrace: ReadonlyArray<{ itemId?: number; ruleCode: string; ruleVersion: string; category: "NONE" | "CHOICE" | "MATCHING" | "ORDERING" | "CLOZE" | "TEXT" | "CONTENT" | "RULE"; reasonCode?: string; evidenceRef?: string; }>; outcomeDigest: string; mistakeCodes: ReadonlyArray<string>; assessedAt: string; };

/**
 * Generated from the contract source.
 */
export type B10PlacementCompleted = ({ tenantId: string; principalId: string; sessionId: string; stateVersion: number; sessionSnapshotDigest: string; placementResultId: string; resultVersion: number; reportId: string; reportVersion: number; resultDigest: string; reportDigest: string; placementManifestId: "P1_PLACEMENT_V1"; placementManifestVersion: "P1_PLACEMENT_V1"; placementManifestDigest: string; dimensionSetDigest: string; totalItemCount: 10; contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; answerRuleSetVersion: string; answerRuleVersion: string; ruleDigest: string; completionRuleVersion: string; targetId: number; targetVersion: number; targetSnapshotDigest: string; resultKind: "ASSESSED" | "SKIPPED"; completionStatus: "COMPLETED" | "SKIPPED"; aggregateScore: number | null; referenceLevel: string | null; confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED"; coverageRatio: number; dimensionSummaries?: readonly [{ dimensionId: "VOCABULARY"; dimensionPercent: number; coverageRatio: number; }, { dimensionId: "BASIC_GRAMMAR"; dimensionPercent: number; coverageRatio: number; }, { dimensionId: "READING"; dimensionPercent: number; coverageRatio: number; }, { dimensionId: "LISTENING"; dimensionPercent: number; coverageRatio: number; }]; requestedStartingLevel?: { level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; authority: "USER_SELECTED_NON_AUTHORITATIVE"; }; completedAt: string; }) & ({ dimensionSummaries: readonly [{ dimensionId: "VOCABULARY"; dimensionPercent: number; coverageRatio: number; }, { dimensionId: "BASIC_GRAMMAR"; dimensionPercent: number; coverageRatio: number; }, { dimensionId: "READING"; dimensionPercent: number; coverageRatio: number; }, { dimensionId: "LISTENING"; dimensionPercent: number; coverageRatio: number; }]; resultKind: "ASSESSED"; completionStatus: "COMPLETED"; aggregateScore: number; referenceLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; confidence: "HIGH" | "MEDIUM" | "LOW"; coverageRatio: number; requestedStartingLevel?: never; } | { resultKind: "SKIPPED"; completionStatus: "SKIPPED"; aggregateScore: null; referenceLevel: null; confidence: "UNVERIFIED"; coverageRatio: 0; dimensionSummaries?: never; });

/**
 * Generated from the contract source.
 */
export type B10LearningMasteryProjected = { tenantId: string; principalId: string; projectionId: string; itemId: number; sourceAttemptId: string; sourceAssessmentEventId: string; contentVersionId: number; contentEpoch: number; fromState: "NONE" | "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REVIEW_QUEUE" | "REOPENED"; toState: "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REVIEW_QUEUE" | "REOPENED"; srsStage?: "NEW" | "D0" | "D1" | "D7" | "MASTERED"; nextReviewAt?: string | null; projectionVersion: number; projectionStatus: "APPLIED" | "RETRYING" | "COMPENSATED" | "MANUAL_REVIEW"; projectedAt: string; };

/**
 * Generated from the contract source.
 */
export type B10LearningReviewScheduled = { tenantId: string; principalId: string; queueItemId: string; itemId: number; sourceProjectionId: string; queueVersion: number; source: "NEW" | "REVIEW" | "MISTAKE" | "RETRY"; state: "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REVIEW_QUEUE" | "REOPENED"; dueAt: string; scheduledAt: string; };

/**
 * Generated from the contract source.
 */
export type B10SagaStarted = { tenantId: string; sagaId: string; sagaType: "ASSESSMENT_TO_LEARNING"; rootEventId: string; rootAggregateId: string; currentStep: "ASSESSMENT_ACCEPT" | "ASSESSMENT_ASSESS" | "LEARNING_PROJECT" | "REVIEW_SCHEDULE"; sagaVersion: number; startedAt: string; };

/**
 * Generated from the contract source.
 */
export type B10SagaCompensated = { tenantId: string; sagaId: string; sagaType: "ASSESSMENT_TO_LEARNING"; failedEventId: string; failedStep: "ASSESSMENT_ACCEPT" | "ASSESSMENT_ASSESS" | "LEARNING_PROJECT" | "REVIEW_SCHEDULE"; compensationKey: string; compensationAction: "MARK_PROJECTION_RETRY" | "REVERT_PENDING_PROJECTION" | "REOPEN_REVIEW_QUEUE" | "CREATE_MANUAL_RECOVERY"; recoveryMode: "AUTOMATIC" | "MANUAL_REVIEW"; compensatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B10EventReplayed = { tenantId: string; replayId: string; sourceDlqId: string; sourceEventId: string; sourceEventName: string; consumerName: string; replayAttempt: number; replayResult: "APPLIED" | "DUPLICATE_IGNORED" | "REQUEUED" | "QUARANTINED"; replayedAt: string; };

/**
 * Generated from the contract source.
 */
export type B11MediaStarted = { playbackId: string; principalId: string; assetId: string; contentVersionId: number; assetVersion: number; positionVersion: number; positionMs?: number; playbackMode: "NORMAL" | "SLOW" | "AB_REPEAT" | "OFFLINE"; };

/**
 * Generated from the contract source.
 */
export type B11MediaSegmentCompleted = { playbackId: string; principalId: string; assetId: string; segmentId: string; segmentVersion: number; contentVersionId: number; positionMs: number; completionPercent?: number; };

/**
 * Generated from the contract source.
 */
export type B11MediaDownloaded = { principalId: string; deviceRefHash: string; assetId: string; manifestId: string; contentVersionId: number; sha256: string; bytesDownloaded: number; offlinePackageId?: string; };

/**
 * Generated from the contract source.
 */
export type B11MediaRevoked = { assetId: string; rightsEpoch: number; reasonCode: "RIGHTS_REVOKED" | "CONTENT_UNPUBLISHED" | "USER_REQUEST" | "SECURITY_INCIDENT" | "RETENTION_EXPIRED"; revokedGrantCount: number; };

/**
 * Generated from the contract source.
 */
export type B11NotificationDelivered = { notificationId: string; principalId: string; channel: "IN_APP" | "PUSH" | "SMS" | "EMAIL"; status: "DELIVERED" | "SKIPPED" | "FAILED"; deliveryVersion: number; deliveredAt: string; providerCode?: string; };

/**
 * Generated from the contract source.
 */
export type B11SyncEnqueued = { clientBatchId: string; principalId: string; deviceRefHash: string; changeCount: number; baseCursor: string; queuedAt: string; };

/**
 * Generated from the contract source.
 */
export type B11SyncConflictDetected = { conflictId: string; clientBatchId: string; principalId: string; entityType: "LISTENING_PROGRESS" | "READING_PROGRESS" | "SHADOWING_PROGRESS" | "SPEAKING_SELF_RATING" | "NOTIFICATION_PREFERENCE"; entityId: string; localVersion: number; serverVersion: number; reasonCode: "VERSION_VECTOR_AHEAD" | "CONTENT_VERSION_CHANGED" | "RIGHTS_REVOKED" | "DUPLICATE_CLIENT_EVENT" | "SAFE_MERGE_UNAVAILABLE" | "STORAGE_FULL"; safeToRetry?: boolean; };

/**
 * Generated from the contract source.
 */
export type B11SyncRecovered = { conflictId: string; principalId: string; recoveryVersion: number; resolution: "SERVER_WINS" | "LOCAL_RETRY" | "MERGED"; nextAction: "PULL_LATEST" | "RETRY_CHANGE" | "NO_ACTION" | "CONTACT_SUPPORT"; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type B11RecordingSaved = { recordingId: string; principalId: string; assetId: string; contentVersionId: number; contentHash: string; durationMs: number; storageMode: "LOCAL_ENCRYPTED" | "REMOTE_ENCRYPTED"; status: "LOCAL_ONLY" | "UPLOAD_PENDING" | "READY"; aiScoringAvailable: false; };

/**
 * Generated from the contract source.
 */
export type B11SpeakingPermissionRequested = { sessionId: string; principalId: string; deviceRefHash: string; permissionVersion: number; result: "REQUESTED" | "GRANTED" | "DENIED" | "UNAVAILABLE"; };

/**
 * Generated from the contract source.
 */
export type B11ShadowingCompleted = { shadowingSessionId: string; principalId: string; contentVersionId: number; completedSegments: number; attemptCount: number; aiScoringAvailable: false; };

/**
 * Generated from the contract source.
 */
export type B12GrowthSessionStarted = { sessionId: string; subjectRef: string; ruleVersion: string; startedAt: string; };

/**
 * Generated from the contract source.
 */
export type B12GrowthLedgerPosted = { ledgerEntryId: string; subjectRef: string; ledgerKind: "SCORE" | "CURRENCY"; amount: number; ruleVersion: string; sourceEventId: string; };

/**
 * Generated from the contract source.
 */
export type B12RewardGranted = { grantId: string; subjectRef: string; rewardCode: string; probabilityVersion: string; grantState: "AVAILABLE" | "CLAIMED" | "REVOKED"; };

/**
 * Generated from the contract source.
 */
export type B12AvatarEquipped = { loadoutId: string; subjectRef: string; assetVersion: string; itemRefs: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B12StudyRoomJoined = { roomId: string; seatId: string; subjectRef: string; leaseVersion: number; visibility: "PRIVATE" | "ROOM_ONLY" | "PUBLIC"; };

/**
 * Generated from the contract source.
 */
export type B12FocusStarted = { focusId: string; roomId: string; subjectRef: string; durationMinutes: number; presetCode: "FOCUS" | "BREAK" | "REVIEW"; };

/**
 * Generated from the contract source.
 */
export type B12StudyRoomLeft = { roomId: string; seatId: string; subjectRef: string; leaseVersion: number; reasonCode: "USER_LEFT" | "LEASE_EXPIRED" | "DISCONNECT_CLEANUP"; };

/**
 * Generated from the contract source.
 */
export type B12LeaderboardRefreshed = { projectionId: string; kind: string; period: string; projectionVersion: string; entryCount: number; };

/**
 * Generated from the contract source.
 */
export type B12SocialReportCreated = { reportId: string; roomId: string; targetRef: string; categoryCode: "HARASSMENT" | "SPAM" | "INAPPROPRIATE_BEHAVIOR" | "SAFETY"; state: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED"; };

/**
 * Generated from the contract source.
 */
export type B12NotificationRequested = { notificationId: string; subjectRef: string; templateId: string; templateVersion: string; channel: "IN_APP" | "PUSH" | "EMAIL"; locale: string; };

/**
 * Generated from the contract source.
 */
export type B12NotificationRetryScheduled = { taskId: string; notificationId: string; attemptCount: number; nextAttemptAt: string; failureCode: string; };

/**
 * Generated from the contract source.
 */
export type B12NotificationRecoveryCompleted = { taskId: string; state: "SUCCEEDED" | "REJECTED" | "MANUAL_REVIEW"; auditRef: string; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type B13CommerceEntitlementActivated = { entitlementId: string; entitlementCode: string; sourceRef: string; startsAt: string; expiresAt: string | null; activationReason: "VERIFIED_PAYMENT" | "ACTIVATION_CODE"; };

/**
 * Generated from the contract source.
 */
export type B13CommerceOrderReconciled = { batchRef: string; provider: string; differenceCount: number; state: "MATCHED" | "DIFF_FOUND" | "REPLAYED"; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type B13AnalyticsMetricProjected = { projectionRef: string; metricCode: string; metricVersion: string; windowStart: string; windowEnd: string; value: number; state: "READY" | "STALE" | "UNAVAILABLE"; };

/**
 * Generated from the contract source.
 */
export type B13AnalyticsRecomputeRequested = { jobId: string; metricCode: string; metricVersion: string; windowStart: string; windowEnd: string; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type IamSessionRevoked = { principalId: string; sessionId: string; deviceId: string; reasonCode: "LOGOUT" | "KICKED" | "REFRESH_REUSE" | "RISK_FREEZE" | "ADMIN"; revocationStatus: "REVOKED"; revokedAt: string; };

/**
 * Generated from the contract source.
 */
export type B26WorkflowOutboxPublished = { outboxId: string; producerService: string; eventType: string; aggregateId: string; dedupeKey: string; aggregateVersion: number; publishedAt: string; attempt: number; };

/**
 * Generated from the contract source.
 */
export type B26WorkflowDeliveryFailed = { failedEventId: string; consumerGroup: string; failureCode: "TIMEOUT" | "TEMPORARY_UNAVAILABLE" | "CONFLICT_RETRYABLE" | "SCHEMA_INVALID" | "FORBIDDEN" | "OWNER_MISMATCH" | "STALE_VERSION"; retryable: boolean; attempt: number; failedAt: string; nextAttemptAt?: string | null; };

/**
 * Generated from the contract source.
 */
export type B26WorkflowDeadLettered = { failedEventId: string; consumerGroup: string; failureCode: string; attempt: number; failedAt: string; recoveryState: "PENDING_REVIEW" | "REPLAY_APPROVED" | "COMPENSATION_PENDING" | "RESOLVED"; };

/**
 * Generated from the contract source.
 */
export type B26WorkflowReplayRequested = { replayRunId: string; sourceTopic: string; sourceEventId: string; requestedByRef: string; approvalRef: string; reasonCode: string; mode: "SINGLE_EVENT" | "DLQ_BATCH"; };

/**
 * Generated from the contract source.
 */
export type B26WorkflowOrderingDeferred = { aggregateId: string; receivedVersion: number; expectedVersion: number; bufferedAt: string; expiresAt: string; action: "BUFFERED" | "DLQ_AFTER_TIMEOUT" | "STALE_SKIPPED"; };

/**
 * Generated from the contract source.
 */
export type B26WorkflowCompensationRequested = { sagaId: string; step: string; aggregateId: string; compensationCode: string; reasonCode: string; state: "COMPENSATION_PENDING" | "COMPENSATED" | "MANUAL_RECOVERY"; };

/**
 * Generated from the contract source.
 */
export type B26WorkflowManualRecoveryRequested = { recoveryId: string; sagaId: string; aggregateId: string; failedStep: string; reasonCode: string; approvalState: "PENDING_TWO_PERSON_REVIEW" | "APPROVED" | "REJECTED" | "EXECUTED"; runbookRef: string; };

/**
 * Generated from the contract source.
 */
export type AuthAccountRegistered = { principalId: string; accountStatus: "ACTIVE"; registeredAt: string; };

/**
 * Generated from the contract source.
 */
export type AuthLoginSucceeded = { principalId: string; sessionId: string; deviceId: string; authMethod: "PASSWORD"; loggedInAt: string; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentItemAssessedV2 = ({ tenantId: string; principalId: string; itemAssessmentId: string; attemptId: string; sessionId: string; logicalItemId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { answerRuleSetVersion: string; answerRuleVersion: string; ruleDigest: string; completionRuleVersion: string; assessmentVersion: string; }; reportPin: { reportId: string; reportVersion: number; reportRuleVersion: string; reportStatus: "READY" | "PARTIAL" | "FAILED"; reportDigest: string; asOf: string; }; objectivePolicyPin: { practiceType: "OBJECTIVE_ASSESSMENT" | "SPEAKING_SELF_RATING" | "WRITING_SELF_RATING" | "ACTIVE_RECALL_SELF_RATING"; objectiveExpected: boolean; policyVersion: string; policyDigest: string; }; objectiveOutcome: "CORRECT_VERIFIED" | "INCORRECT" | "UNANSWERED" | "REVEALED_BEFORE_ANSWER" | "GUESSED" | "NO_OBJECTIVE_EXPECTED"; objectiveNumerator: number; objectiveDenominator: number; objectiveCorrect: boolean; guessSignal: boolean; semanticErrorCategory: "KNOWLEDGE_GAP" | "MEMORY_FUZZY" | "CONFUSABLE" | "RULE_CONCEPT" | "LISTENING_DISCRIMINATION" | "READING_COMPREHENSION" | "SPELLING_OR_STRUCTURE" | "CARELESS_OR_OMISSION" | "TIME_INSUFFICIENT" | "UNCLASSIFIED"; mappingVersion: string; verificationStage: "NONE" | "IMMEDIATE_REPAIR" | "D1" | "D7"; reasonTrace: readonly [{ ruleCode: string; ruleVersion: string; category: "KNOWLEDGE_GAP" | "MEMORY_FUZZY" | "CONFUSABLE" | "RULE_CONCEPT" | "LISTENING_DISCRIMINATION" | "READING_COMPREHENSION" | "SPELLING_OR_STRUCTURE" | "CARELESS_OR_OMISSION" | "TIME_INSUFFICIENT" | "UNCLASSIFIED"; reasonCode: string; evidenceRef: string; }, ...Array<{ ruleCode: string; ruleVersion: string; category: "KNOWLEDGE_GAP" | "MEMORY_FUZZY" | "CONFUSABLE" | "RULE_CONCEPT" | "LISTENING_DISCRIMINATION" | "READING_COMPREHENSION" | "SPELLING_OR_STRUCTURE" | "CARELESS_OR_OMISSION" | "TIME_INSUFFICIENT" | "UNCLASSIFIED"; reasonCode: string; evidenceRef: string; }>]; outcomeDigest: string; assessmentFactWatermark: string; assessedAt: string; }) & ({ objectivePolicyPin: { objectiveExpected: true; practiceType: "OBJECTIVE_ASSESSMENT"; }; objectiveOutcome: "CORRECT_VERIFIED"; objectiveNumerator: 1; objectiveDenominator: 1; objectiveCorrect: true; guessSignal: false; } | { objectivePolicyPin: { objectiveExpected: true; practiceType: "OBJECTIVE_ASSESSMENT"; }; objectiveOutcome: "INCORRECT"; objectiveNumerator: 0; objectiveDenominator: 1; objectiveCorrect: false; guessSignal: false; } | { objectivePolicyPin: { objectiveExpected: true; practiceType: "OBJECTIVE_ASSESSMENT"; }; objectiveOutcome: "UNANSWERED"; objectiveNumerator: 0; objectiveDenominator: 1; objectiveCorrect: false; guessSignal: false; } | { objectivePolicyPin: { objectiveExpected: true; practiceType: "OBJECTIVE_ASSESSMENT"; }; objectiveOutcome: "REVEALED_BEFORE_ANSWER"; objectiveNumerator: 0; objectiveDenominator: 1; objectiveCorrect: false; guessSignal: false; } | { objectivePolicyPin: { objectiveExpected: true; practiceType: "OBJECTIVE_ASSESSMENT"; }; objectiveOutcome: "GUESSED"; objectiveNumerator: 1; objectiveDenominator: 1; objectiveCorrect: true; guessSignal: true; } | { objectivePolicyPin: { objectiveExpected: true; practiceType: "OBJECTIVE_ASSESSMENT"; }; objectiveOutcome: "GUESSED"; objectiveNumerator: 0; objectiveDenominator: 1; objectiveCorrect: false; guessSignal: true; } | { objectivePolicyPin: { objectiveExpected: false; practiceType: "SPEAKING_SELF_RATING" | "WRITING_SELF_RATING" | "ACTIVE_RECALL_SELF_RATING"; }; objectiveOutcome: "NO_OBJECTIVE_EXPECTED"; objectiveNumerator: 0; objectiveDenominator: 0; objectiveCorrect: false; guessSignal: false; });

/**
 * Generated from the contract source.
 */
export type B10LearningMasteryProjectedV2 = ({ tenantId: string; principalId: string; projectionId: string; logicalItemId: string; sourceAssessmentEventId: string; sourceItemAssessmentId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; masteryStageBefore: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; masteryStageAfter: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; evidenceCount: number; evidenceDigest: string; evidenceLocalDates: readonly [] | readonly [string] | readonly [string, string] | readonly [string, string, string]; d7Gate: ({ result: "NOT_DUE" | "NOT_PASSED" | "PASSED" | "FAILED"; reasonCode: "D7_NOT_DUE" | "D7_NOT_PASSED" | "D7_PASSED" | "D7_FAILED" | "MASTERY_GATE_NOT_MET"; }) & ({ result: "NOT_DUE"; reasonCode: "D7_NOT_DUE"; } | { result: "NOT_PASSED"; reasonCode: "D7_NOT_PASSED"; } | { result: "NOT_PASSED"; reasonCode: "MASTERY_GATE_NOT_MET"; } | { result: "PASSED"; reasonCode: "D7_PASSED"; } | { result: "FAILED"; reasonCode: "D7_FAILED"; }); aggregateScore: number; latestEffectiveQuality: number; latestGuessSignal: boolean; masteryEpochId: string; masteryEpochVersion: number; projectionVersion: number; masteryRuleVersion: "P1_MASTERY_V1"; masteryFactWatermark: string; reasonTrace: readonly [{ ruleCode: string; ruleVersion: string; category: "EVIDENCE" | "D7_GATE" | "STAGE_TRANSITION" | "CONTENT_VERSION" | "REPLAY"; reasonCode: string; evidenceRef: string; }, ...Array<{ ruleCode: string; ruleVersion: string; category: "EVIDENCE" | "D7_GATE" | "STAGE_TRANSITION" | "CONTENT_VERSION" | "REPLAY"; reasonCode: string; evidenceRef: string; }>]; projectedAt: string; }) & ({ masteryStageAfter: "MASTERED"; d7Gate: { result: "PASSED"; reasonCode: "D7_PASSED"; } & ({ result: "NOT_DUE"; reasonCode: "D7_NOT_DUE"; } | { result: "NOT_PASSED"; reasonCode: "D7_NOT_PASSED"; } | { result: "NOT_PASSED"; reasonCode: "MASTERY_GATE_NOT_MET"; } | { result: "PASSED"; reasonCode: "D7_PASSED"; } | { result: "FAILED"; reasonCode: "D7_FAILED"; }); evidenceCount: number; evidenceLocalDates: readonly [string, string, string]; aggregateScore: number; } | { masteryStageAfter: "CONSOLIDATED"; d7Gate: { result: "PASSED"; reasonCode: "D7_PASSED"; } & ({ result: "NOT_DUE"; reasonCode: "D7_NOT_DUE"; } | { result: "NOT_PASSED"; reasonCode: "D7_NOT_PASSED"; } | { result: "NOT_PASSED"; reasonCode: "MASTERY_GATE_NOT_MET"; } | { result: "PASSED"; reasonCode: "D7_PASSED"; } | { result: "FAILED"; reasonCode: "D7_FAILED"; }); evidenceCount: number; evidenceLocalDates: readonly [string, string, string]; aggregateScore: number; latestEffectiveQuality: 3; latestGuessSignal: false; } | { masteryStageAfter: "NEW" | "LEARNING"; });

/**
 * Generated from the contract source.
 */
export type B10LearningReviewScheduledV2 = ({ tenantId: string; principalId: string; queueItemId: string; logicalItemId: string; queueVersion: number; srsStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; repairWorkflowState: "REVIEW_QUEUE" | "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REOPENED"; masteryStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; sourceAssessmentEventId: string; sourceItemAssessmentId: string; algorithmVersion: "SM2_Q03_V1"; timePolicyVersion: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; dueLocalDate: string; dueAt: string; timezoneId: string; reasonCodes: readonly ["RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE", ...Array<"RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE">]; scheduledAt: string; }) & ({ repairWorkflowState: "DELAY_VERIFY_D1"; reasonCodes: readonly ["RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE", ...Array<"RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE">]; } | { repairWorkflowState: "DELAY_VERIFY_D7"; reasonCodes: readonly ["RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE", ...Array<"RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE">]; } | { repairWorkflowState: "MASTERED"; masteryStage: "MASTERED" | "CONSOLIDATED"; reasonCodes: readonly ["RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE", ...Array<"RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE">]; } | { repairWorkflowState: "REOPENED"; masteryStage: "LEARNING"; reasonCodes: readonly ["RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE", ...Array<"RESUME_SESSION" | "SUBMISSION_CONFIRMATION" | "D1_VERIFICATION" | "D7_VERIFICATION" | "DUE_TODAY" | "OVERDUE_HIGH_RISK" | "RECENT_MISTAKE" | "REPEATED_ERROR_CATEGORY" | "GOAL_FOUNDATION" | "GOAL_COLLEGE_CET" | "GOAL_POSTGRADUATE_ENGLISH" | "GOAL_WORKPLACE_DAILY" | "PLAN_CHECKPOINT" | "NEW_CORE" | "SKILL_ROTATION" | "CATCH_UP_PROTECTION" | "MANUAL_LEGAL_COURSE" | "GOAL_LIGHT_ITEM_UNAVAILABLE" | "CONTENT_ESTIMATE_UNSCHEDULABLE">]; } | { repairWorkflowState: "REVIEW_QUEUE" | "LEARNING"; });

/**
 * Generated from the contract source.
 */
export type M1014LearningTaskCompleted = { completionId: string; subjectRef: string; taskId: string; completionVersion: string; taskStatus: "COMPLETED"; completionFact: "SERVER_SETTLED"; completedAt: string; rootEventId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { completionRuleVersion: string; ruleDigest: string; }; outcomeDigest: string; };

/**
 * Generated from the contract source.
 */
export type M1014GamificationXpLedgerPosted = { ledgerEntryId: string; principalId: string; tenantId: string; entryType: "CREDIT" | "DEBIT" | "COMPENSATION"; amount: number; currency: "NON_CASH_PLATFORM_CREDIT"; tupleKey: string; dedupeKey: string; lineageDigest: string; rewardRuleVersion: string; sourceEventId: string; sourceEventName: "learning.task.completed.v2" | "assessment.item.assessed.v2" | "learning.mastery.projected.v2"; createdAt: string; auditRef: string; };

/**
 * Generated from the contract source.
 */
export type M1014GamificationRewardGranted = { grantId: string; principalId: string; tenantId: string; rewardCode: string; grantState: "AVAILABLE" | "CLAIMED" | "EXPIRED" | "REVOKED"; catalogVersion: string; rewardRuleVersion: string; probabilityVersion: string; drawId: string; eligibleRewardSetDigest: string; selectedRewardId: string; sourceLedgerEntryId: string; sourceEventId: string; lineageDigest: string; monetization: "FREE_NON_CASH"; drawnAt: string; auditRef: string; };

/**
 * Generated from the contract source.
 */
export type M1014StudyRoomSeatJoined = { roomId: string; seatId: string; subjectRef: string; spaceType: "PUBLIC_THEME_ROOM" | "INVITE_STUDY_ROOM"; leaseId: string; leaseVersion: number; leasePolicyVersion: string; leaseExpiresAt: string; roomVisibility: "PUBLIC" | "INVITE_ONLY"; seatState: "ACTIVE"; joinedAt: string; lineageDigest: string; };

/**
 * Generated from the contract source.
 */
export type M1014StudyRoomFocusStarted = { focusId: string; roomId: string; seatId: string; subjectRef: string; leaseId: string; leaseVersion: number; focusVersion: number; focusKind: "FOCUS" | "BREAK" | "REVIEW"; focusTagCode: "VOCABULARY" | "LISTENING" | "READING" | "GRAMMAR" | "SPEAKING" | "WRITING"; durationMinutes: 25 | 45; focusPolicyVersion: string; startedAt: string; endsAt: string; lineageDigest: string; };

/**
 * Generated from the contract source.
 */
export type M1014StudyRoomSeatLeft = { roomId: string; seatId: string; subjectRef: string; spaceType: "PUBLIC_THEME_ROOM" | "INVITE_STUDY_ROOM"; leaseId: string; leaseVersion: number; leasePolicyVersion: string; reasonCode: "USER_LEFT" | "LEASE_EXPIRED" | "DISCONNECT_CLEANUP" | "FOCUS_COMPLETED"; leftAt: string; lineageDigest: string; };

/**
 * Generated from the contract source.
 */
export type M1014LeaderboardSnapshotPublished = { snapshotId: string; scope: "GLOBAL" | "ROOM" | "GOAL_GROUP"; spaceType: "PUBLIC_THEME_ROOM" | "INVITE_STUDY_ROOM" | "CHECKIN_GOAL_GROUP"; metric: "FOCUS_MINUTES" | "MASTERED_WORDS" | "XP"; period: "DAY" | "WEEK"; timezoneId: "Asia/Shanghai"; projectionVersion: number; ruleVersion: string; tieBreakVersion: string; watermark: string; entryCount: number; snapshotDigest: string; snapshotAt: string; auditRef: string; lineageDigest: string; };

/**
 * Generated from the contract source.
 */
export type M1014SocialReportCreated = { reportId: string; roomId: string; reporterId: string; tenantId: string; caseId: string; targetType: "SEAT" | "ROOM" | "PRESET_INTERACTION"; targetRef: string; reasonCode: "HARASSMENT" | "SPAM" | "INAPPROPRIATE_BEHAVIOR" | "SAFETY" | "IMPERSONATION"; state: "SUBMITTED" | "TRIAGED" | "RESOLVED" | "DISMISSED"; moderationPolicyVersion: string; auditRef: string; createdAt: string; lineageDigest: string; };

/**
 * Generated from the contract source.
 */
export type M1015CommerceOrderCreated = { orderId: string; orderVersion: number; skuId: string; priceSnapshotId: string; amountMinor: number; currency: string; state: "CREATED" | "PAYMENT_PENDING"; sourcePlatform: "MOBILE" | "WEB" | "PWA"; };

/**
 * Generated from the contract source.
 */
export type M1015CommercePaymentRequested = { paymentAttemptId: string; paymentAttemptVersion: number; orderId: string; provider: "SANDBOX_HMAC"; environment: "SANDBOX"; state: "REQUESTED"; amountMinor: number; currency: string; };

/**
 * Generated from the contract source.
 */
export type M1015CommercePaymentCallbackReceived = { callbackReceiptRef: string; orderId: string; paymentAttemptId: string; provider: "SANDBOX_HMAC"; environment: "SANDBOX"; providerEventId: string; transactionRef: string; state: "RECEIVED" | "VERIFIED" | "REJECTED"; verificationRef: string; tupleDigest: string; };

/**
 * Generated from the contract source.
 */
export type M1015CommercePaymentVerified = { paymentAttemptId: string; orderId: string; callbackReceiptRef: string; provider: "SANDBOX_HMAC"; environment: "SANDBOX"; amountMinor: number; currency: string; verificationRef: string; verifiedAt: string; state: "VERIFIED"; };

/**
 * Generated from the contract source.
 */
export type M1015CommerceEntitlementActivated = { entitlementId: string; entitlementVersion: number; entitlementCode: string; scopeCode: string; sourceType: "VERIFIED_PAYMENT" | "REDEEMED_ACTIVATION"; sourceRef: string; sourceVersion: number; policyVersion: string; effectiveAt: string; startsAt: string; expiresAt: string | null; invalidationVersion: number; state: "ACTIVE"; };

/**
 * Generated from the contract source.
 */
export type M1015CommerceEntitlementRevoked = { entitlementId: string; entitlementVersion: number; scopeCode: string; sourceVersion: number; policyVersion: string; state: "REVOKED"; reasonCode: "FULL_REFUND" | "MANUAL_REVOKE" | "SECURITY" | "EXPIRED"; tombstoneVersion: number; invalidationVersion: number; effectiveAt: string; receiptRef: string; auditRef: string; postRecoveryRerunRequired: boolean; };

/**
 * Generated from the contract source.
 */
export type M1015CommerceRefundSettled = { refundId: string; stateVersion: number; orderId: string; refundMode: "FULL_ONLY"; state: "SETTLED"; settlementRef: string; amountMinor: number; currency: string; settledAt: string; expectedStateVersion: number; receiptRef: string; auditRef: string; entitlementRevocationReceiptRef: string; };

/**
 * Generated from the contract source.
 */
export type M1015CommerceReconciliationDiscrepancyRecorded = { reconciliationCaseRef: string; reconciliationVersion: number; batchRef: string; provider: "SANDBOX_HMAC"; environment: "SANDBOX"; discrepancyCode: "STATE_MISMATCH" | "MISSING_RECEIPT" | "DUPLICATE_RECEIPT" | "AMOUNT_MISMATCH"; differenceCount: number; state: "MISMATCH"; recordedAt: string; expectedStateVersion: number; expectedStateDigest: string; actualStateDigest: string; manualHoldRef: string; auditRef: string; receiptRef: string; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type M1015CommerceReconciliationRecoveryReceipted = { reconciliationCaseRef: string; reconciliationVersion: number; batchRef: string; closureReceiptRef: string; state: "CLOSED"; postRerunStatus: "MATCHED_AFTER_RECOVERY"; ownerReceiptRefs: readonly [string, ...Array<string>]; approvalRefs: readonly [string, string]; closedAt: string; auditRef: string; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationRequested = { notificationId: string; deliveryVersion: number; sourceEventId: string; notificationType: "LEARNING" | "REVIEW" | "STREAK" | "EXAM" | "CHECKPOINT" | "STUDY_ROOM" | "REWARDS" | "COURSE" | "MEMBERSHIP" | "MARKETING" | "SECURITY" | "ACCOUNT" | "PAYMENT" | "SYSTEM" | "ACCOUNT_VERIFICATION" | "SECURITY_ALERT" | "PHONE_BINDING_CHANGE" | "CRITICAL_ACCOUNT_PAYMENT"; category: "LEARNING" | "REVIEW" | "STREAK" | "EXAM" | "CHECKPOINT" | "STUDY_ROOM" | "REWARDS" | "COURSE" | "MEMBERSHIP" | "MARKETING" | "SECURITY" | "ACCOUNT" | "PAYMENT" | "SYSTEM"; channel: "IN_APP" | "PUSH" | "EMAIL" | "SMS"; templateKey: string; templateVersion: number; locale: "zh-CN"; parameterDigest: string; dedupeKey: string; contentVersionId: string; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationRetryScheduled = { notificationId: string; deliveryVersion: number; attempt: number; maxAttempts: 5; failureClass: "TRANSIENT_PROVIDER" | "TIMEOUT" | "RATE_LIMIT" | "TEMPORARY_NETWORK"; nextAttemptAt: string; workflowTaskRef: string; notificationStatus: "RETRY_SCHEDULED"; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationRecoveryCompleted = { notificationId: string; deliveryVersion: number; action: "SCHEDULE_RETRY" | "MOVE_TO_DLQ" | "REPLAY" | "MANUAL_RECOVERY"; state: "RECOVERED" | "REJECTED"; recoveryReceiptId: string; domainFactsUntouched: true; notificationStatus: "DELIVERED" | "FAILED" | "CANCELLED" | "DEAD_LETTER" | "MANUAL_RECOVERY" | "RETRY_SCHEDULED"; };

/**
 * Generated from the contract source.
 */
export type M1016SyncCommandReceipted = { clientEventId: string; clientSeq: number; baseVersion: number; contentVersionId: string; payloadHash: string; entityType: string; entityId: string; operation: "UPSERT" | "DELETE" | "APPEND"; occurredAt: string; idempotencyKey: string; outcome: "ACCEPTED" | "APPLIED" | "REPLAYED" | "PROCESSING" | "CONFLICT" | "REJECTED"; serverVersion: number; receiptId: string; ownerService: "learning-service" | "assessment-service" | "learner-service" | "notification-service" | "admin-ops-service"; };

/**
 * Generated from the contract source.
 */
export type M1016SyncConflictDetected = { conflictId: string; clientEventId: string; entityType: string; entityId: string; baseVersion: number; localVersion: number; serverVersion: number; contentVersionId: string; reasonCode: "DUPLICATE_EVENT_DIFFERENT_HASH" | "OUT_OF_ORDER" | "SEQUENCE_GAP" | "STALE_BASE_VERSION" | "FUTURE_BASE_VERSION" | "CONTENT_VERSION_MISMATCH" | "OWNER_VERSION_MISMATCH" | "PERMISSION_OR_RIGHTS_CHANGED"; safeServerReference: string; allowedResolution: "RELOAD_SERVER" | "KEEP_LOCAL_DRAFT" | "RETRY_WITH_NEW_BASE" | "CONTACT_SUPPORT" | "DISCARD_LOCAL"; recoveryTaskId: string; };

/**
 * Generated from the contract source.
 */
export type M1016SyncRecovered = { conflictId: string; clientEventId: string; entityType: string; entityId: string; contentVersionId: string; action: "KEEP_SERVER_FACT" | "DISCARD_LOCAL_DRAFT" | "RETRY_CANONICAL_COMMAND"; recoveryReceiptId: string; outcome: "RECOVERED" | "RETRY_REQUIRED" | "REJECTED"; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type M1016SupportTicketCreated = { eventId: string; traceId: string; requestId: string; schemaVersion: number; ticketId: string; ticketVersion: number; state: "OPEN" | "ASSIGNED" | "WAITING_USER" | "WAITING_INTERNAL" | "RESOLVED" | "CLOSED" | "REOPENED"; categoryCode: "ACCOUNT_SECURITY" | "CONTENT_CORRECTION" | "LEARNING_SYNC" | "MEDIA_DEVICE" | "ENTITLEMENT_ORDER" | "PRIVACY" | "OTHER"; slaPolicyRef: string; redactionVersion: number; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportTicketResolved = { eventId: string; traceId: string; requestId: string; schemaVersion: number; ticketId: string; ticketVersion: number; state: "RESOLVED" | "CLOSED"; categoryCode: "ACCOUNT_SECURITY" | "CONTENT_CORRECTION" | "LEARNING_SYNC" | "MEDIA_DEVICE" | "ENTITLEMENT_ORDER" | "PRIVACY" | "OTHER"; slaPolicyRef: string; resolutionCode: string; ownerResultRef: string; redactionVersion: number; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1017PrivacyExportRequested = { exportId: string; exportVersion: number; purposeCode: "DATA_EXPORT"; scope: "ACCOUNT_AND_LEARNER_DATA"; policyRef: string; policyVersion: string; verificationRef: string; requestedAt: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1017PrivacyExportCompleted = { exportId: string; exportVersion: number; status: "READY"; ownerReceiptSetDigest: string; ownerReceiptCount: number; redactionPolicyRef: string; expiresAt: string; completedAt: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1017AccountDeletionRequested = { deletionRequestId: string; deletionVersion: number; status: "PENDING_COOLING_OFF"; coolingOffHours: 168; coolingOffEndsAt: string; policyRef: string; policyVersion: number; ownerPlanDigest: string; verificationRef: string; requestedAt: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1017AccountDeletionCancelled = { deletionRequestId: string; deletionVersion: number; status: "CANCELLED"; reasonCode: "USER_CANCELLED" | "AUTHORITY_REVOKED" | "POLICY_REJECTED"; cancelledAt: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1017AccountDeletionCompleted = { deletionRequestId: string; deletionVersion: number; status: "ANONYMIZED"; receiptSetDigest: string; deletedOwnerCount: number; anonymizedOwnerCount: number; retainedOwnerCount: number; sessionsRevokedAt: string; completedAt: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1018IamAccountBootstrapCreated = { principalId: string; aggregateVersion: number; bootstrapState: "PENDING_ELIGIBILITY"; bootstrapReason: "SELF_REGISTERED_ADULT_CANDIDATE"; createdAt: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1018IamLearningEligibilityChanged = { principalId: string; aggregateVersion: number; eligibilityScope: "P1_ADULT_LEARNING"; eligibilitySnapshotVersion: number; eligibilitySnapshotDigest: string; eligibilityState: "ELIGIBLE" | "RESTRICTED"; reasonCode: "ELIGIBILITY_CONFIRMED" | "ADULT_GATE_RESTRICTED" | "REQUIRED_CONSENT_MISSING" | "REQUIRED_CONSENT_WITHDRAWN" | "REVALIDATION_REQUIRED" | "POLICY_REVOKED"; policyVersion: string; revalidationRequired: boolean; effectiveAt: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1018IamPolicySecurityStateChanged = { policyVersionId: string; aggregateVersion: number; policyVersion: string; policyArtifactDigest: string; securityState: "ACTIVE" | "REVOKED"; invalidationId: string; invalidationScope: "AFFECTED_PEP_SECURITY_CACHES" | "REVOCATION_AND_AFFECTED_PEP_SECURITY_CACHES"; denyUntilCurrentVersionProven: true; issuedAt: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type B10LearningReportReadyV1 = { tenantId: string; principalId: string; reportId: string; attemptId: string; sessionId: string; contentCode: string; contentVersionId: number; scoreBucket: "FULL" | "PARTIAL" | "ZERO"; totalItems: number; totalCorrect: number; totalMistakes: number; completedAt: string; };

export interface LearningSrsBatchCreatedEvent extends PlatformEventEnvelope<LearningSrsBatchCreated, "learning.event.v1"> {
  eventName: "learning.srs.batch_created.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
}

export interface VocabularyReviewAcceptedEvent extends PlatformEventEnvelope<VocabularyReviewAccepted, "learning.event.v1"> {
  eventName: "vocabulary.review.accepted.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
}

export interface VocabularySrsStateChangedEvent extends PlatformEventEnvelope<VocabularySrsStateChanged, "learning.event.v1"> {
  eventName: "vocabulary.srs.state_changed.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
}

export interface AssessmentAnswerScoredEvent extends PlatformEventEnvelope<AssessmentAnswerScored, "learning.event.v1"> {
  eventName: "assessment.answer_scored.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
}

export interface MasteryStateChangedEvent extends PlatformEventEnvelope<MasteryStateChanged, "learning.event.v1"> {
  eventName: "mastery.state_changed.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
}

export interface LearningTaskCompletedEvent extends PlatformEventEnvelope<LearningTaskCompleted, "learning.event.v1"> {
  eventName: "learning.task.completed.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
}

export interface CmsContentSubmittedEvent extends PlatformEventEnvelope<CmsContentSubmitted, "content.event.v1"> {
  eventName: "cms.content.submitted.v1";
  version: 1;
  schemaVersion: "content.event.v1";
}

export interface CmsReviewDecidedEvent extends PlatformEventEnvelope<CmsReviewDecided, "content.event.v1"> {
  eventName: "cms.review.decided.v1";
  version: 1;
  schemaVersion: "content.event.v1";
}

export interface CmsContentPublishedEvent extends PlatformEventEnvelope<CmsContentPublished, "content.event.v1"> {
  eventName: "cms.content.published.v1";
  version: 1;
  schemaVersion: "content.event.v1";
}

export interface CmsContentRolledBackEvent extends PlatformEventEnvelope<CmsContentRolledBack, "content.event.v1"> {
  eventName: "cms.content.rolled_back.v1";
  version: 1;
  schemaVersion: "content.event.v1";
}

export interface CommerceOrderPaidEvent extends PlatformEventEnvelope<CommerceOrderPaid, "entitlement.event.v1"> {
  eventName: "commerce.order.paid.v1";
  version: 1;
  schemaVersion: "entitlement.event.v1";
}

export interface CommerceEntitlementActivatedEvent extends PlatformEventEnvelope<B13CommerceEntitlementActivated, "commerce.event.v1"> {
  eventName: "commerce.entitlement.activated.v1";
  version: 1;
  schemaVersion: "commerce.event.v1";
  dedupeKey: string;
}

export interface CommerceEntitlementRevokedEvent extends PlatformEventEnvelope<CommerceEntitlementRevoked, "entitlement.event.v1"> {
  eventName: "commerce.entitlement.revoked.v1";
  version: 1;
  schemaVersion: "entitlement.event.v1";
}

export interface CommerceSubscriptionChangedEvent extends PlatformEventEnvelope<CommerceSubscriptionChanged, "entitlement.event.v1"> {
  eventName: "commerce.subscription.changed.v1";
  version: 1;
  schemaVersion: "entitlement.event.v1";
}

export interface NotificationCreatedEvent extends PlatformEventEnvelope<NotificationCreated, "notification.event.v1"> {
  eventName: "notification.created.v1";
  version: 1;
  schemaVersion: "notification.event.v1";
}

export interface NotificationDeliveredEvent extends PlatformEventEnvelope<B11NotificationDelivered, "notification.event.v1"> {
  eventName: "notification.delivered.v1";
  version: 1;
  schemaVersion: "notification.event.v1";
  dedupeKey: string;
}

export interface NotificationReadEvent extends PlatformEventEnvelope<NotificationRead, "notification.event.v1"> {
  eventName: "notification.read.v1";
  version: 1;
  schemaVersion: "notification.event.v1";
}

export interface SyncLearningCheckpointSavedEvent extends PlatformEventEnvelope<SyncLearningCheckpointSaved, "sync.event.v1"> {
  eventName: "sync.learning.checkpoint_saved.v1";
  version: 1;
  schemaVersion: "sync.event.v1";
}

export interface SyncConflictDetectedEvent extends PlatformEventEnvelope<SyncConflictDetected, "sync.event.v1"> {
  eventName: "sync.conflict.detected.v1";
  version: 1;
  schemaVersion: "sync.event.v1";
}

export interface SyncCursorAdvancedEvent extends PlatformEventEnvelope<SyncCursorAdvanced, "sync.event.v1"> {
  eventName: "sync.cursor.advanced.v1";
  version: 1;
  schemaVersion: "sync.event.v1";
}

export interface AuthSessionRevokedEvent extends PlatformEventEnvelope<AuthSessionRevoked, "auth.event.v1"> {
  eventName: "auth.session.revoked.v1";
  version: 1;
  schemaVersion: "auth.event.v1";
}

export interface AssessmentItemSubmittedEvent extends PlatformEventEnvelope<AssessmentItemSubmitted, "learning.event.v1"> {
  eventName: "assessment.item.submitted.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
}

export interface AuthDeviceKickedEvent extends PlatformEventEnvelope<AuthDeviceKicked, "auth.event.v1"> {
  eventName: "auth.device.kicked.v1";
  version: 1;
  schemaVersion: "auth.event.v1";
}

export interface PrivacyExportRequestedEvent extends PlatformEventEnvelope<PrivacyExportRequested, "privacy.event.v1"> {
  eventName: "privacy.export.requested.v1";
  version: 1;
  schemaVersion: "privacy.event.v1";
}

export interface PrivacyExportCompletedEvent extends PlatformEventEnvelope<PrivacyExportCompleted, "privacy.event.v1"> {
  eventName: "privacy.export.completed.v1";
  version: 1;
  schemaVersion: "privacy.event.v1";
}

export interface AssessmentStreamBuiltEvent extends PlatformEventEnvelope<AssessmentStreamBuilt, "assessment.event.v1"> {
  eventName: "assessment.stream_built.v1";
  version: 1;
  schemaVersion: "assessment.event.v1";
}

export interface AssessmentAnswerSubmittedEvent extends PlatformEventEnvelope<AssessmentAnswerSubmitted, "assessment.event.v1"> {
  eventName: "assessment.answer_submitted.v1";
  version: 1;
  schemaVersion: "assessment.event.v1";
}

export interface MasteryVerificationStateChangedEvent extends PlatformEventEnvelope<MasteryVerificationStateChanged, "mastery.event.v1"> {
  eventName: "mastery.verification_state_changed.v1";
  version: 1;
  schemaVersion: "mastery.event.v1";
}

export interface ExamSessionStateChangedEvent extends PlatformEventEnvelope<ExamSessionStateChanged, "exam.event.v1"> {
  eventName: "exam.session_state_changed.v1";
  version: 1;
  schemaVersion: "exam.event.v1";
}

export interface ExamAntiCheatRecordedEvent extends PlatformEventEnvelope<ExamAntiCheatRecorded, "exam.event.v1"> {
  eventName: "exam.anti_cheat_recorded.v1";
  version: 1;
  schemaVersion: "exam.event.v1";
}

export interface ReportGeneratedEvent extends PlatformEventEnvelope<ReportGenerated, "mastery.event.v1"> {
  eventName: "report.generated.v1";
  version: 1;
  schemaVersion: "mastery.event.v1";
}

export interface VocabularyReviewFilteredEvent extends PlatformEventEnvelope<VocabularyReviewFiltered, "learning.event.v1"> {
  eventName: "vocabulary.review.filtered.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
}

export interface VocabularyExpressionCreatedEvent extends PlatformEventEnvelope<VocabularyExpressionCreated, "learning.event.v1"> {
  eventName: "vocabulary.expression.created.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
}

export interface GrammarPracticeCompletedEvent extends PlatformEventEnvelope<GrammarPracticeCompleted, "grammar.event.v1"> {
  eventName: "grammar.practice.completed.v1";
  version: 1;
  schemaVersion: "grammar.event.v1";
}

export interface WritingEvaluationCompletedEvent extends PlatformEventEnvelope<WritingEvaluationCompleted, "writing.event.v1"> {
  eventName: "writing.evaluation.completed.v1";
  version: 1;
  schemaVersion: "writing.event.v1";
}

export interface ListeningDictationSubmittedEvent extends PlatformEventEnvelope<ListeningDictationSubmitted, "listening.event.v1"> {
  eventName: "listening.dictation.submitted.v1";
  version: 1;
  schemaVersion: "listening.event.v1";
}

export interface ReadingProgressUpdatedEvent extends PlatformEventEnvelope<ReadingProgressUpdated, "reading.event.v1"> {
  eventName: "reading.progress.updated.v1";
  version: 1;
  schemaVersion: "reading.event.v1";
}

export interface SpeakingSelfRatingSubmittedEvent extends PlatformEventEnvelope<SpeakingSelfRatingSubmitted, "speaking.event.v1"> {
  eventName: "speaking.self_rating.submitted.v1";
  version: 1;
  schemaVersion: "speaking.event.v1";
}

export interface OfflineSyncAppliedEvent extends PlatformEventEnvelope<OfflineSyncApplied, "offline.event.v1"> {
  eventName: "offline.sync.applied.v1";
  version: 1;
  schemaVersion: "offline.event.v1";
}

export interface GrammarMasteryUpdatedEvent extends PlatformEventEnvelope<GrammarMasteryUpdated, "grammar.event.v1"> {
  eventName: "grammar.mastery.updated.v1";
  version: 1;
  schemaVersion: "grammar.event.v1";
}

export interface ListeningProgressSavedEvent extends PlatformEventEnvelope<ListeningProgressSaved, "listening.event.v1"> {
  eventName: "listening.progress.saved.v1";
  version: 1;
  schemaVersion: "listening.event.v1";
}

export interface SpeakingShadowingProgressedEvent extends PlatformEventEnvelope<ShadowingProgressed, "speaking.event.v1"> {
  eventName: "speaking.shadowing.progressed.v1";
  version: 1;
  schemaVersion: "speaking.event.v1";
}

export interface MediaOfflinePackageSyncedEvent extends PlatformEventEnvelope<OfflinePackageSynced, "offline.event.v1"> {
  eventName: "media.offline.package.synced.v1";
  version: 1;
  schemaVersion: "offline.event.v1";
}

export interface GamificationProfileUpdatedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.profile.updated.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationXpLedgerAppendedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.xp.ledger_appended.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationCurrencyLedgerAppendedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.currency.ledger_appended.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationStreakDayValidatedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.streak.day_validated.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationStreakRescueCompletedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.streak.rescue_completed.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationQuestProgressedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.quest.progressed.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationQuestClaimedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.quest.claimed.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationAchievementUnlockedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.achievement.unlocked.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationChestGrantedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.chest.granted.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationChestOpenedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.chest.opened.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationAvatarLoadoutEquippedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.avatar.loadout_equipped.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamificationSeasonPointsUpdatedEvent extends PlatformEventEnvelope<B4FactPayload, "gamification.event.v1"> {
  eventName: "gamification.season.points_updated.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
}

export interface GamesSessionCreatedEvent extends PlatformEventEnvelope<B4FactPayload, "games.event.v1"> {
  eventName: "games.session.created.v1";
  version: 1;
  schemaVersion: "games.event.v1";
}

export interface GamesSessionEventAcceptedEvent extends PlatformEventEnvelope<B4FactPayload, "games.event.v1"> {
  eventName: "games.session.event_accepted.v1";
  version: 1;
  schemaVersion: "games.event.v1";
}

export interface GamesSessionCompletedEvent extends PlatformEventEnvelope<B4FactPayload, "games.event.v1"> {
  eventName: "games.session.completed.v1";
  version: 1;
  schemaVersion: "games.event.v1";
}

export interface SocialRoomJoinedEvent extends PlatformEventEnvelope<B4FactPayload, "social.event.v1"> {
  eventName: "social.room.joined.v1";
  version: 1;
  schemaVersion: "social.event.v1";
}

export interface SocialFocusStartedEvent extends PlatformEventEnvelope<B4FactPayload, "social.event.v1"> {
  eventName: "social.focus.started.v1";
  version: 1;
  schemaVersion: "social.event.v1";
}

export interface SocialFocusCompletedEvent extends PlatformEventEnvelope<B4FactPayload, "social.event.v1"> {
  eventName: "social.focus.completed.v1";
  version: 1;
  schemaVersion: "social.event.v1";
}

export interface SocialInteractionSentEvent extends PlatformEventEnvelope<B4FactPayload, "social.event.v1"> {
  eventName: "social.interaction.sent.v1";
  version: 1;
  schemaVersion: "social.event.v1";
}

export interface OfflinePackageAuthorizedEvent extends PlatformEventEnvelope<B4FactPayload, "offline.event.v1"> {
  eventName: "offline.package.authorized.v1";
  version: 1;
  schemaVersion: "offline.event.v1";
}

export interface OfflineB4SyncAppliedEvent extends PlatformEventEnvelope<B4FactPayload, "offline.event.v1"> {
  eventName: "offline.b4.sync_applied.v1";
  version: 1;
  schemaVersion: "offline.event.v1";
}

export interface SocialRoomLeftEvent extends PlatformEventEnvelope<B4FactPayload, "social.event.v1"> {
  eventName: "social.room.left.v1";
  version: 1;
  schemaVersion: "social.event.v1";
}

export interface SocialFocusUpdatedEvent extends PlatformEventEnvelope<B4FactPayload, "social.event.v1"> {
  eventName: "social.focus.updated.v1";
  version: 1;
  schemaVersion: "social.event.v1";
}

export interface SocialModerationReportedEvent extends PlatformEventEnvelope<B4FactPayload, "social.event.v1"> {
  eventName: "social.moderation.reported.v1";
  version: 1;
  schemaVersion: "social.event.v1";
}

export interface SocialModerationBlockedEvent extends PlatformEventEnvelope<B4FactPayload, "social.event.v1"> {
  eventName: "social.moderation.blocked.v1";
  version: 1;
  schemaVersion: "social.event.v1";
}

export interface SocialModerationMutedEvent extends PlatformEventEnvelope<B4FactPayload, "social.event.v1"> {
  eventName: "social.moderation.muted.v1";
  version: 1;
  schemaVersion: "social.event.v1";
}

export interface NotificationsMessageReadEvent extends PlatformEventEnvelope<B4FactPayload, "notifications.event.v1"> {
  eventName: "notifications.message_read.v1";
  version: 1;
  schemaVersion: "notifications.event.v1";
}

export interface NotificationsPreferencesUpdatedEvent extends PlatformEventEnvelope<B4FactPayload, "notifications.event.v1"> {
  eventName: "notifications.preferences_updated.v1";
  version: 1;
  schemaVersion: "notifications.event.v1";
}

export interface OfflinePackageDownloadStateUpdatedEvent extends PlatformEventEnvelope<B4FactPayload, "offline.event.v1"> {
  eventName: "offline.package.download_state_updated.v1";
  version: 1;
  schemaVersion: "offline.event.v1";
}

export interface OfflineSyncConflictRecordedEvent extends PlatformEventEnvelope<B4FactPayload, "offline.event.v1"> {
  eventName: "offline.sync.conflict_recorded.v1";
  version: 1;
  schemaVersion: "offline.event.v1";
}

export interface CommerceOrderCreatedEvent extends PlatformEventEnvelope<B5FactPayload, "commerce.event.v1"> {
  eventName: "commerce.order.created.v1";
  version: 1;
  schemaVersion: "commerce.event.v1";
}

export interface CommercePaymentRequestedEvent extends PlatformEventEnvelope<B5FactPayload, "commerce.event.v1"> {
  eventName: "commerce.payment.requested.v1";
  version: 1;
  schemaVersion: "commerce.event.v1";
}

export interface CommercePaymentCallbackReceivedEvent extends PlatformEventEnvelope<B5FactPayload, "commerce.event.v1"> {
  eventName: "commerce.payment.callback_received.v1";
  version: 1;
  schemaVersion: "commerce.event.v1";
}

export interface CommercePaymentVerifiedEvent extends PlatformEventEnvelope<B5FactPayload, "commerce.event.v1"> {
  eventName: "commerce.payment.verified.v1";
  version: 1;
  schemaVersion: "commerce.event.v1";
}

export interface CommerceRefundCompletedEvent extends PlatformEventEnvelope<B5FactPayload, "commerce.event.v1"> {
  eventName: "commerce.refund.completed.v1";
  version: 1;
  schemaVersion: "commerce.event.v1";
}

export interface CommerceHouseholdChangedEvent extends PlatformEventEnvelope<B5FactPayload, "commerce.event.v1"> {
  eventName: "commerce.household.changed.v1";
  version: 1;
  schemaVersion: "commerce.event.v1";
}

export interface CmsContentVersionSavedEvent extends PlatformEventEnvelope<B5FactPayload, "cms.event.v1"> {
  eventName: "cms.content.version_saved.v1";
  version: 1;
  schemaVersion: "cms.event.v1";
}

export interface CmsImportCompletedEvent extends PlatformEventEnvelope<B5FactPayload, "cms.event.v1"> {
  eventName: "cms.import.completed.v1";
  version: 1;
  schemaVersion: "cms.event.v1";
}

export interface SafetyPrecheckBlockedEvent extends PlatformEventEnvelope<B5FactPayload, "safety.event.v1"> {
  eventName: "safety.precheck.blocked.v1";
  version: 1;
  schemaVersion: "safety.event.v1";
}

export interface RiskDecisionCreatedEvent extends PlatformEventEnvelope<B5FactPayload, "risk.event.v1"> {
  eventName: "risk.decision.created.v1";
  version: 1;
  schemaVersion: "risk.event.v1";
}

export interface FinanceReconciliationDiscrepancyEvent extends PlatformEventEnvelope<B5FactPayload, "finance.event.v1"> {
  eventName: "finance.reconciliation.discrepancy.v1";
  version: 1;
  schemaVersion: "finance.event.v1";
}

export interface OpsFlagUpdatedEvent extends PlatformEventEnvelope<B5FactPayload, "ops.event.v1"> {
  eventName: "ops.flag.updated.v1";
  version: 1;
  schemaVersion: "ops.event.v1";
}

export interface SupportTicketCreatedEvent extends PlatformEventEnvelope<B5FactPayload, "support.event.v1"> {
  eventName: "support.ticket.created.v1";
  version: 1;
  schemaVersion: "support.event.v1";
}

export interface SupportTicketResolvedEvent extends PlatformEventEnvelope<B5FactPayload, "support.event.v1"> {
  eventName: "support.ticket.resolved.v1";
  version: 1;
  schemaVersion: "support.event.v1";
}

export interface PlatformBuildRegisteredEvent extends PlatformEventEnvelope<B6FactPayload, "platform.event.v1"> {
  eventName: "platform.build.registered.v1";
  version: 1;
  schemaVersion: "platform.event.v1";
}

export interface PlatformCompatibilityCheckedEvent extends PlatformEventEnvelope<B6FactPayload, "platform.event.v1"> {
  eventName: "platform.compatibility.checked.v1";
  version: 1;
  schemaVersion: "platform.event.v1";
}

export interface PlatformPerformanceDegradedEvent extends PlatformEventEnvelope<B6FactPayload, "platform.event.v1"> {
  eventName: "platform.performance.degraded.v1";
  version: 1;
  schemaVersion: "platform.event.v1";
}

export interface QualityE2eCompletedEvent extends PlatformEventEnvelope<B6FactPayload, "quality.event.v1"> {
  eventName: "quality.e2e.completed.v1";
  version: 1;
  schemaVersion: "quality.event.v1";
}

export interface QualitySecurityScanCompletedEvent extends PlatformEventEnvelope<B6FactPayload, "quality.event.v1"> {
  eventName: "quality.security.scan_completed.v1";
  version: 1;
  schemaVersion: "quality.event.v1";
}

export interface QualityReliabilityCompletedEvent extends PlatformEventEnvelope<B6FactPayload, "quality.event.v1"> {
  eventName: "quality.reliability.completed.v1";
  version: 1;
  schemaVersion: "quality.event.v1";
}

export interface ObservabilityAlertRaisedEvent extends PlatformEventEnvelope<B6FactPayload, "observability.event.v1"> {
  eventName: "observability.alert.raised.v1";
  version: 1;
  schemaVersion: "observability.event.v1";
}

export interface DataBackupDrillCompletedEvent extends PlatformEventEnvelope<B6FactPayload, "data.event.v1"> {
  eventName: "data.backup.drill_completed.v1";
  version: 1;
  schemaVersion: "data.event.v1";
}

export interface ReleaseGateEvaluatedEvent extends PlatformEventEnvelope<B6FactPayload, "release.event.v1"> {
  eventName: "release.gate.evaluated.v1";
  version: 1;
  schemaVersion: "release.event.v1";
}

export interface AuthPrincipalMappedEvent extends PlatformEventEnvelope<AuthPrincipalMapped, "iam.auth.event.v1"> {
  eventName: "auth.principal.mapped.v1";
  version: 1;
  schemaVersion: "iam.auth.event.v1";
  dedupeKey: string;
}

export interface AuthSessionRotatedEvent extends PlatformEventEnvelope<AuthSessionRotated, "iam.auth.event.v1"> {
  eventName: "auth.session.rotated.v1";
  version: 1;
  schemaVersion: "iam.auth.event.v1";
  dedupeKey: string;
}

export interface AuthSessionReplayDetectedEvent extends PlatformEventEnvelope<AuthSessionReplayDetected, "iam.auth.event.v1"> {
  eventName: "auth.session.replay_detected.v1";
  version: 1;
  schemaVersion: "iam.auth.event.v1";
  dedupeKey: string;
}

export interface AuthDeviceRevokedEvent extends PlatformEventEnvelope<AuthDeviceRevoked, "iam.auth.event.v1"> {
  eventName: "auth.device.revoked.v1";
  version: 1;
  schemaVersion: "iam.auth.event.v1";
  dedupeKey: string;
}

export interface AuthConsentUpdatedEvent extends PlatformEventEnvelope<AuthConsentUpdated, "iam.auth.event.v1"> {
  eventName: "auth.consent.updated.v1";
  version: 1;
  schemaVersion: "iam.auth.event.v1";
  dedupeKey: string;
}

export interface AuthAdultGateRejectedEvent extends PlatformEventEnvelope<AuthAdultGateRejected, "iam.auth.event.v1"> {
  eventName: "auth.adult_gate.rejected.v1";
  version: 1;
  schemaVersion: "iam.auth.event.v1";
  dedupeKey: string;
}

export interface IamPolicyVersionChangedEvent extends PlatformEventEnvelope<IamPolicyVersionChanged, "iam.security.event.v1"> {
  eventName: "iam.policy.version_changed.v1";
  version: 1;
  schemaVersion: "iam.security.event.v1";
  dedupeKey: string;
}

export interface LearnerProfileUpdatedEvent extends PlatformEventEnvelope<B9LearnerProfileUpdated, "learner.event.v1"> {
  eventName: "learner.profile.updated.v1";
  version: 1;
  schemaVersion: "learner.event.v1";
  dedupeKey: string;
}

export interface LearnerTargetUpdatedEvent extends PlatformEventEnvelope<B9LearnerTargetUpdated, "learner.event.v1"> {
  eventName: "learner.target.updated.v1";
  version: 1;
  schemaVersion: "learner.event.v1";
  dedupeKey: string;
}

export interface LearnerFirstDayProjectedEvent extends PlatformEventEnvelope<B9LearnerFirstDayProjected, "learner.event.v1"> {
  eventName: "learner.first_day.projected.v1";
  version: 1;
  schemaVersion: "learner.event.v1";
  dedupeKey: string;
}

export interface ContentVersionSubmittedEvent extends PlatformEventEnvelope<B9ContentVersionSubmitted, "content.event.v1"> {
  eventName: "content.version.submitted.v1";
  version: 1;
  schemaVersion: "content.event.v1";
  dedupeKey: string;
}

export interface ContentVersionReviewedEvent extends PlatformEventEnvelope<B9ContentVersionReviewed, "content.event.v1"> {
  eventName: "content.version.reviewed.v1";
  version: 1;
  schemaVersion: "content.event.v1";
  dedupeKey: string;
}

export interface ContentVersionPublishedEvent extends PlatformEventEnvelope<B9ContentVersionPublished, "content.event.v1"> {
  eventName: "content.version.published.v1";
  version: 1;
  schemaVersion: "content.event.v1";
  dedupeKey: string;
}

export interface ContentVersionUnpublishedEvent extends PlatformEventEnvelope<B9ContentVersionUnpublished, "content.event.v1"> {
  eventName: "content.version.unpublished.v1";
  version: 1;
  schemaVersion: "content.event.v1";
  dedupeKey: string;
}

export interface ContentVersionRolledBackEvent extends PlatformEventEnvelope<B9ContentVersionRolledBack, "content.event.v1"> {
  eventName: "content.version.rolled_back.v1";
  version: 1;
  schemaVersion: "content.event.v1";
  dedupeKey: string;
}

export interface ContentPublicProjectionInvalidatedEvent extends PlatformEventEnvelope<B9PublicProjectionInvalidated, "content.event.v1"> {
  eventName: "content.public_projection.invalidated.v1";
  version: 1;
  schemaVersion: "content.event.v1";
  dedupeKey: string;
}

export interface AssessmentAttemptSubmittedEvent extends PlatformEventEnvelope<B10AssessmentAttemptSubmitted, "assessment.event.v1"> {
  eventName: "assessment.attempt.submitted.v1";
  version: 1;
  schemaVersion: "assessment.event.v1";
  dedupeKey: string;
}

export interface AssessmentAttemptAssessedEvent extends PlatformEventEnvelope<B10AssessmentAttemptAssessed, "assessment.event.v1"> {
  eventName: "assessment.attempt.assessed.v1";
  version: 1;
  schemaVersion: "assessment.event.v1";
  dedupeKey: string;
}

export interface AssessmentPlacementCompletedEvent extends PlatformEventEnvelope<B10PlacementCompleted, "assessment.event.v1"> {
  eventName: "assessment.placement.completed.v1";
  version: 1;
  schemaVersion: "assessment.event.v1";
  dedupeKey: string;
}

export interface LearningMasteryProjectedEvent extends PlatformEventEnvelope<B10LearningMasteryProjected, "learning.event.v1"> {
  eventName: "learning.mastery.projected.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
  dedupeKey: string;
}

export interface LearningReviewScheduledEvent extends PlatformEventEnvelope<B10LearningReviewScheduled, "learning.event.v1"> {
  eventName: "learning.review.scheduled.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
  dedupeKey: string;
}

export interface WorkflowAssessmentLearningSagaStartedEvent extends PlatformEventEnvelope<B10SagaStarted, "workflow.event.v1"> {
  eventName: "workflow.assessment_learning.saga_started.v1";
  version: 1;
  schemaVersion: "workflow.event.v1";
  dedupeKey: string;
}

export interface WorkflowAssessmentLearningSagaCompensatedEvent extends PlatformEventEnvelope<B10SagaCompensated, "workflow.event.v1"> {
  eventName: "workflow.assessment_learning.saga_compensated.v1";
  version: 1;
  schemaVersion: "workflow.event.v1";
  dedupeKey: string;
}

export interface WorkflowEventReplayedEvent extends PlatformEventEnvelope<B10EventReplayed, "workflow.event.v1"> {
  eventName: "workflow.event.replayed.v1";
  version: 1;
  schemaVersion: "workflow.event.v1";
  dedupeKey: string;
}

export interface MediaStartedEvent extends PlatformEventEnvelope<B11MediaStarted, "media.event.v1"> {
  eventName: "media.started.v1";
  version: 1;
  schemaVersion: "media.event.v1";
  dedupeKey: string;
}

export interface MediaSegmentCompletedEvent extends PlatformEventEnvelope<B11MediaSegmentCompleted, "media.event.v1"> {
  eventName: "media.segment_completed.v1";
  version: 1;
  schemaVersion: "media.event.v1";
  dedupeKey: string;
}

export interface MediaDownloadedEvent extends PlatformEventEnvelope<B11MediaDownloaded, "media.event.v1"> {
  eventName: "media.downloaded.v1";
  version: 1;
  schemaVersion: "media.event.v1";
  dedupeKey: string;
}

export interface MediaRevokedEvent extends PlatformEventEnvelope<B11MediaRevoked, "media.event.v1"> {
  eventName: "media.revoked.v1";
  version: 1;
  schemaVersion: "media.event.v1";
  dedupeKey: string;
}

export interface SyncEnqueuedEvent extends PlatformEventEnvelope<B11SyncEnqueued, "sync.event.v1"> {
  eventName: "sync.enqueued.v1";
  version: 1;
  schemaVersion: "sync.event.v1";
  dedupeKey: string;
}

export interface SyncConflictDetectedB11Event extends PlatformEventEnvelope<B11SyncConflictDetected, "sync.event.v1"> {
  eventName: "sync.conflict_detected.v1";
  version: 1;
  schemaVersion: "sync.event.v1";
  dedupeKey: string;
}

export interface SyncRecoveredEvent extends PlatformEventEnvelope<B11SyncRecovered, "sync.event.v1"> {
  eventName: "sync.recovered.v1";
  version: 1;
  schemaVersion: "sync.event.v1";
  dedupeKey: string;
}

export interface RecordingSavedEvent extends PlatformEventEnvelope<B11RecordingSaved, "speaking.event.v1"> {
  eventName: "recording.saved.v1";
  version: 1;
  schemaVersion: "speaking.event.v1";
  dedupeKey: string;
}

export interface SpeakingPermissionRequestedEvent extends PlatformEventEnvelope<B11SpeakingPermissionRequested, "speaking.event.v1"> {
  eventName: "speaking.permission_requested.v1";
  version: 1;
  schemaVersion: "speaking.event.v1";
  dedupeKey: string;
}

export interface ShadowingCompletedEvent extends PlatformEventEnvelope<B11ShadowingCompleted, "speaking.event.v1"> {
  eventName: "shadowing.completed.v1";
  version: 1;
  schemaVersion: "speaking.event.v1";
  dedupeKey: string;
}

export interface GamificationSessionStartedEvent extends PlatformEventEnvelope<B12GrowthSessionStarted, "gamification.event.v1"> {
  eventName: "gamification.session_started.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
  dedupeKey: string;
}

export interface GamificationXpLedgerPostedEvent extends PlatformEventEnvelope<B12GrowthLedgerPosted, "gamification.event.v1"> {
  eventName: "gamification.xp.ledger_posted.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
  dedupeKey: string;
}

export interface GamificationRewardGrantedEvent extends PlatformEventEnvelope<B12RewardGranted, "gamification.event.v1"> {
  eventName: "gamification.reward.granted.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
  dedupeKey: string;
}

export interface GamificationAvatarEquippedEvent extends PlatformEventEnvelope<B12AvatarEquipped, "gamification.event.v1"> {
  eventName: "gamification.avatar.equipped.v1";
  version: 1;
  schemaVersion: "gamification.event.v1";
  dedupeKey: string;
}

export interface StudyRoomJoinedEvent extends PlatformEventEnvelope<B12StudyRoomJoined, "social.event.v1"> {
  eventName: "study_room.joined.v1";
  version: 1;
  schemaVersion: "social.event.v1";
  dedupeKey: string;
}

export interface StudyRoomFocusStartedEvent extends PlatformEventEnvelope<B12FocusStarted, "social.event.v1"> {
  eventName: "study_room.focus_started.v1";
  version: 1;
  schemaVersion: "social.event.v1";
  dedupeKey: string;
}

export interface StudyRoomLeftEvent extends PlatformEventEnvelope<B12StudyRoomLeft, "social.event.v1"> {
  eventName: "study_room.left.v1";
  version: 1;
  schemaVersion: "social.event.v1";
  dedupeKey: string;
}

export interface LeaderboardRefreshedEvent extends PlatformEventEnvelope<B12LeaderboardRefreshed, "social.event.v1"> {
  eventName: "leaderboard.refreshed.v1";
  version: 1;
  schemaVersion: "social.event.v1";
  dedupeKey: string;
}

export interface SocialReportCreatedEvent extends PlatformEventEnvelope<B12SocialReportCreated, "social.event.v1"> {
  eventName: "social.report.created.v1";
  version: 1;
  schemaVersion: "social.event.v1";
  dedupeKey: string;
}

export interface NotificationRequestedEvent extends PlatformEventEnvelope<B12NotificationRequested, "notification.event.v1"> {
  eventName: "notification.requested.v1";
  version: 1;
  schemaVersion: "notification.event.v1";
  dedupeKey: string;
}

export interface NotificationRetryScheduledEvent extends PlatformEventEnvelope<B12NotificationRetryScheduled, "notification.event.v1"> {
  eventName: "notification.retry_scheduled.v1";
  version: 1;
  schemaVersion: "notification.event.v1";
  dedupeKey: string;
}

export interface NotificationRecoveryCompletedEvent extends PlatformEventEnvelope<B12NotificationRecoveryCompleted, "notification.event.v1"> {
  eventName: "notification.recovery.completed.v1";
  version: 1;
  schemaVersion: "notification.event.v1";
  dedupeKey: string;
}

export interface CommerceOrderReconciledEvent extends PlatformEventEnvelope<B13CommerceOrderReconciled, "commerce.event.v1"> {
  eventName: "commerce.order.reconciled.v1";
  version: 1;
  schemaVersion: "commerce.event.v1";
  dedupeKey: string;
}

export interface AnalyticsMetricProjectedEvent extends PlatformEventEnvelope<B13AnalyticsMetricProjected, "analytics.event.v1"> {
  eventName: "analytics.metric.projected.v1";
  version: 1;
  schemaVersion: "analytics.event.v1";
  dedupeKey: string;
}

export interface AnalyticsRecomputeRequestedEvent extends PlatformEventEnvelope<B13AnalyticsRecomputeRequested, "analytics.event.v1"> {
  eventName: "analytics.recompute.requested.v1";
  version: 1;
  schemaVersion: "analytics.event.v1";
  dedupeKey: string;
}

export interface IamSessionRevokedEvent extends PlatformEventEnvelope<IamSessionRevoked, "iam.auth.event.v1"> {
  eventName: "iam.session.revoked.v1";
  version: 1;
  schemaVersion: "iam.auth.event.v1";
  dedupeKey: string;
}

export interface WorkflowOutboxPublishedEvent extends PlatformEventEnvelope<B26WorkflowOutboxPublished, "workflow.event.v1"> {
  eventName: "workflow.outbox.published.v1";
  version: 1;
  schemaVersion: "workflow.event.v1";
  dedupeKey: string;
}

export interface WorkflowEventDeliveryFailedEvent extends PlatformEventEnvelope<B26WorkflowDeliveryFailed, "workflow.event.v1"> {
  eventName: "workflow.event.delivery_failed.v1";
  version: 1;
  schemaVersion: "workflow.event.v1";
  dedupeKey: string;
}

export interface WorkflowEventDeadLetteredEvent extends PlatformEventEnvelope<B26WorkflowDeadLettered, "workflow.event.v1"> {
  eventName: "workflow.event.dead_lettered.v1";
  version: 1;
  schemaVersion: "workflow.event.v1";
  dedupeKey: string;
}

export interface WorkflowEventReplayRequestedEvent extends PlatformEventEnvelope<B26WorkflowReplayRequested, "workflow.event.v1"> {
  eventName: "workflow.event.replay_requested.v1";
  version: 1;
  schemaVersion: "workflow.event.v1";
  dedupeKey: string;
}

export interface WorkflowEventOrderingDeferredEvent extends PlatformEventEnvelope<B26WorkflowOrderingDeferred, "workflow.event.v1"> {
  eventName: "workflow.event.ordering_deferred.v1";
  version: 1;
  schemaVersion: "workflow.event.v1";
  dedupeKey: string;
}

export interface WorkflowSagaCompensationRequestedEvent extends PlatformEventEnvelope<B26WorkflowCompensationRequested, "workflow.saga.v1"> {
  eventName: "workflow.saga.compensation_requested.v1";
  version: 1;
  schemaVersion: "workflow.saga.v1";
  dedupeKey: string;
}

export interface WorkflowSagaManualRecoveryRequestedEvent extends PlatformEventEnvelope<B26WorkflowManualRecoveryRequested, "workflow.saga.v1"> {
  eventName: "workflow.saga.manual_recovery_requested.v1";
  version: 1;
  schemaVersion: "workflow.saga.v1";
  dedupeKey: string;
}

export interface AuthAccountRegisteredEvent extends PlatformEventEnvelope<AuthAccountRegistered, "iam.auth.event.v1"> {
  eventName: "auth.account.registered.v1";
  version: 1;
  schemaVersion: "iam.auth.event.v1";
  dedupeKey: string;
}

export interface AuthLoginSucceededEvent extends PlatformEventEnvelope<AuthLoginSucceeded, "iam.auth.event.v1"> {
  eventName: "auth.login.succeeded.v1";
  version: 1;
  schemaVersion: "iam.auth.event.v1";
  dedupeKey: string;
}

export interface AssessmentItemAssessedEvent extends PlatformEventEnvelope<B10AssessmentItemAssessedV2, "assessment.event.v2"> {
  eventName: "assessment.item.assessed.v2";
  version: 2;
  schemaVersion: "assessment.event.v2";
  dedupeKey: string;
}

export interface LearningMasteryProjectedB10Event extends PlatformEventEnvelope<B10LearningMasteryProjectedV2, "learning.event.v2"> {
  eventName: "learning.mastery.projected.v2";
  version: 2;
  schemaVersion: "learning.event.v2";
  dedupeKey: string;
}

export interface LearningReviewScheduledB10Event extends PlatformEventEnvelope<B10LearningReviewScheduledV2, "learning.event.v2"> {
  eventName: "learning.review.scheduled.v2";
  version: 2;
  schemaVersion: "learning.event.v2";
  dedupeKey: string;
}

export interface LearningTaskCompletedM1014LearningTaskCompletedEvent extends PlatformEventEnvelope<M1014LearningTaskCompleted, "learning.event.v2"> {
  eventName: "learning.task.completed.v2";
  version: 2;
  schemaVersion: "learning.event.v2";
  dedupeKey: string;
}

export interface GamificationXpLedgerPostedM1014GamificationXpLedgerPostedEvent extends PlatformEventEnvelope<M1014GamificationXpLedgerPosted, "gamification.event.v2"> {
  eventName: "gamification.xp.ledger_posted.v2";
  version: 2;
  schemaVersion: "gamification.event.v2";
  dedupeKey: string;
}

export interface GamificationRewardGrantedM1014GamificationRewardGrantedEvent extends PlatformEventEnvelope<M1014GamificationRewardGranted, "gamification.event.v2"> {
  eventName: "gamification.reward.granted.v2";
  version: 2;
  schemaVersion: "gamification.event.v2";
  dedupeKey: string;
}

export interface StudyRoomSeatJoinedEvent extends PlatformEventEnvelope<M1014StudyRoomSeatJoined, "social.event.v2"> {
  eventName: "study_room.seat_joined.v2";
  version: 2;
  schemaVersion: "social.event.v2";
  dedupeKey: string;
}

export interface StudyRoomFocusStartedM1014StudyRoomFocusStartedEvent extends PlatformEventEnvelope<M1014StudyRoomFocusStarted, "social.event.v2"> {
  eventName: "study_room.focus_started.v2";
  version: 2;
  schemaVersion: "social.event.v2";
  dedupeKey: string;
}

export interface StudyRoomSeatLeftEvent extends PlatformEventEnvelope<M1014StudyRoomSeatLeft, "social.event.v2"> {
  eventName: "study_room.seat_left.v2";
  version: 2;
  schemaVersion: "social.event.v2";
  dedupeKey: string;
}

export interface LeaderboardSnapshotPublishedEvent extends PlatformEventEnvelope<M1014LeaderboardSnapshotPublished, "social.event.v2"> {
  eventName: "leaderboard.snapshot_published.v2";
  version: 2;
  schemaVersion: "social.event.v2";
  dedupeKey: string;
}

export interface SocialReportCreatedM1014SocialReportCreatedEvent extends PlatformEventEnvelope<M1014SocialReportCreated, "social.event.v2"> {
  eventName: "social.report.created.v2";
  version: 2;
  schemaVersion: "social.event.v2";
  dedupeKey: string;
}

export interface CommerceOrderCreatedM1015CommerceOrderCreatedEvent extends PlatformEventEnvelope<M1015CommerceOrderCreated, "commerce.event.v2"> {
  eventName: "commerce.order.created.v2";
  version: 2;
  schemaVersion: "commerce.event.v2";
  dedupeKey: string;
}

export interface CommercePaymentRequestedM1015CommercePaymentRequestedEvent extends PlatformEventEnvelope<M1015CommercePaymentRequested, "commerce.event.v2"> {
  eventName: "commerce.payment.requested.v2";
  version: 2;
  schemaVersion: "commerce.event.v2";
  dedupeKey: string;
}

export interface CommercePaymentCallbackReceivedM1015CommercePaymentCallbackReceivedEvent extends PlatformEventEnvelope<M1015CommercePaymentCallbackReceived, "commerce.event.v2"> {
  eventName: "commerce.payment.callback_received.v2";
  version: 2;
  schemaVersion: "commerce.event.v2";
  dedupeKey: string;
}

export interface CommercePaymentVerifiedM1015CommercePaymentVerifiedEvent extends PlatformEventEnvelope<M1015CommercePaymentVerified, "commerce.event.v2"> {
  eventName: "commerce.payment.verified.v2";
  version: 2;
  schemaVersion: "commerce.event.v2";
  dedupeKey: string;
}

export interface CommerceEntitlementActivatedM1015CommerceEntitlementActivatedEvent extends PlatformEventEnvelope<M1015CommerceEntitlementActivated, "commerce.event.v2"> {
  eventName: "commerce.entitlement.activated.v2";
  version: 2;
  schemaVersion: "commerce.event.v2";
  dedupeKey: string;
}

export interface CommerceEntitlementRevokedM1015CommerceEntitlementRevokedEvent extends PlatformEventEnvelope<M1015CommerceEntitlementRevoked, "commerce.event.v2"> {
  eventName: "commerce.entitlement.revoked.v2";
  version: 2;
  schemaVersion: "commerce.event.v2";
  dedupeKey: string;
}

export interface CommerceRefundSettledEvent extends PlatformEventEnvelope<M1015CommerceRefundSettled, "commerce.event.v2"> {
  eventName: "commerce.refund.settled.v2";
  version: 2;
  schemaVersion: "commerce.event.v2";
  dedupeKey: string;
}

export interface CommerceReconciliationDiscrepancyRecordedEvent extends PlatformEventEnvelope<M1015CommerceReconciliationDiscrepancyRecorded, "commerce.event.v2"> {
  eventName: "commerce.reconciliation.discrepancy_recorded.v2";
  version: 2;
  schemaVersion: "commerce.event.v2";
  dedupeKey: string;
}

export interface CommerceReconciliationRecoveryReceiptedEvent extends PlatformEventEnvelope<M1015CommerceReconciliationRecoveryReceipted, "commerce.event.v2"> {
  eventName: "commerce.reconciliation.recovery_receipted.v2";
  version: 2;
  schemaVersion: "commerce.event.v2";
  dedupeKey: string;
}

export interface NotificationRequestedM1016NotificationRequestedEvent extends PlatformEventEnvelope<M1016NotificationRequested, "notification.event.v2"> {
  eventName: "notification.requested.v2";
  version: 2;
  schemaVersion: "notification.event.v2";
  dedupeKey: string;
}

export interface NotificationRetryScheduledM1016NotificationRetryScheduledEvent extends PlatformEventEnvelope<M1016NotificationRetryScheduled, "notification.event.v2"> {
  eventName: "notification.retry_scheduled.v2";
  version: 2;
  schemaVersion: "notification.event.v2";
  dedupeKey: string;
}

export interface NotificationRecoveryCompletedM1016NotificationRecoveryCompletedEvent extends PlatformEventEnvelope<M1016NotificationRecoveryCompleted, "notification.event.v2"> {
  eventName: "notification.recovery.completed.v2";
  version: 2;
  schemaVersion: "notification.event.v2";
  dedupeKey: string;
}

export interface SyncCommandReceiptedEvent extends PlatformEventEnvelope<M1016SyncCommandReceipted, "learning.event.v2"> {
  eventName: "sync.command_receipted.v2";
  version: 2;
  schemaVersion: "learning.event.v2";
  dedupeKey: string;
}

export interface SyncConflictDetectedM1016SyncConflictDetectedEvent extends PlatformEventEnvelope<M1016SyncConflictDetected, "learning.event.v2"> {
  eventName: "sync.conflict_detected.v2";
  version: 2;
  schemaVersion: "learning.event.v2";
  dedupeKey: string;
}

export interface SyncRecoveredM1016SyncRecoveredEvent extends PlatformEventEnvelope<M1016SyncRecovered, "learning.event.v2"> {
  eventName: "sync.recovered.v2";
  version: 2;
  schemaVersion: "learning.event.v2";
  dedupeKey: string;
}

export interface SupportTicketCreatedM1016SupportTicketCreatedEvent extends PlatformEventEnvelope<M1016SupportTicketCreated, "support.event.v2"> {
  eventName: "support.ticket.created.v2";
  version: 2;
  schemaVersion: "support.event.v2";
  dedupeKey: string;
}

export interface SupportTicketResolvedM1016SupportTicketResolvedEvent extends PlatformEventEnvelope<M1016SupportTicketResolved, "support.event.v2"> {
  eventName: "support.ticket.resolved.v2";
  version: 2;
  schemaVersion: "support.event.v2";
  dedupeKey: string;
}

export interface PrivacyExportRequestedM1017PrivacyExportRequestedEvent extends PlatformEventEnvelope<M1017PrivacyExportRequested, "privacy.event.v2"> {
  eventName: "privacy.export.requested.v2";
  version: 2;
  schemaVersion: "privacy.event.v2";
  dedupeKey: string;
}

export interface PrivacyExportCompletedM1017PrivacyExportCompletedEvent extends PlatformEventEnvelope<M1017PrivacyExportCompleted, "privacy.event.v2"> {
  eventName: "privacy.export.completed.v2";
  version: 2;
  schemaVersion: "privacy.event.v2";
  dedupeKey: string;
}

export interface AccountDeletionRequestedEvent extends PlatformEventEnvelope<M1017AccountDeletionRequested, "iam.event.v2"> {
  eventName: "account.deletion.requested.v2";
  version: 2;
  schemaVersion: "iam.event.v2";
  dedupeKey: string;
}

export interface AccountDeletionCancelledEvent extends PlatformEventEnvelope<M1017AccountDeletionCancelled, "iam.event.v2"> {
  eventName: "account.deletion.cancelled.v2";
  version: 2;
  schemaVersion: "iam.event.v2";
  dedupeKey: string;
}

export interface AccountDeletionCompletedEvent extends PlatformEventEnvelope<M1017AccountDeletionCompleted, "iam.event.v2"> {
  eventName: "account.deletion.completed.v2";
  version: 2;
  schemaVersion: "iam.event.v2";
  dedupeKey: string;
}

export interface IamAccountBootstrapCreatedEvent extends PlatformEventEnvelope<M1018IamAccountBootstrapCreated, "iam.event.v2"> {
  eventName: "iam.account.bootstrap.created.v2";
  version: 2;
  schemaVersion: "iam.event.v2";
  dedupeKey: string;
}

export interface IamLearningEligibilityChangedEvent extends PlatformEventEnvelope<M1018IamLearningEligibilityChanged, "iam.event.v2"> {
  eventName: "iam.learning_eligibility.changed.v2";
  version: 2;
  schemaVersion: "iam.event.v2";
  dedupeKey: string;
}

export interface IamPolicySecurityStateChangedEvent extends PlatformEventEnvelope<M1018IamPolicySecurityStateChanged, "iam.event.v2"> {
  eventName: "iam.policy.security_state_changed.v2";
  version: 2;
  schemaVersion: "iam.event.v2";
  dedupeKey: string;
}

export interface LearningReportReadyEvent extends PlatformEventEnvelope<B10LearningReportReadyV1, "learning.event.v1"> {
  eventName: "learning.report.ready.v1";
  version: 1;
  schemaVersion: "learning.event.v1";
  dedupeKey: string;
}

/** All catalog entries, including HISTORICAL_CANDIDATE records. New v2 publishers must use CanonicalPlatformEvent. */
export type EventCatalogCandidate = LearningSrsBatchCreatedEvent | VocabularyReviewAcceptedEvent | VocabularySrsStateChangedEvent | AssessmentAnswerScoredEvent | MasteryStateChangedEvent | LearningTaskCompletedEvent | CmsContentSubmittedEvent | CmsReviewDecidedEvent | CmsContentPublishedEvent | CmsContentRolledBackEvent | CommerceOrderPaidEvent | CommerceEntitlementActivatedEvent | CommerceEntitlementRevokedEvent | CommerceSubscriptionChangedEvent | NotificationCreatedEvent | NotificationDeliveredEvent | NotificationReadEvent | SyncLearningCheckpointSavedEvent | SyncConflictDetectedEvent | SyncCursorAdvancedEvent | AuthSessionRevokedEvent | AssessmentItemSubmittedEvent | AuthDeviceKickedEvent | PrivacyExportRequestedEvent | PrivacyExportCompletedEvent | AssessmentStreamBuiltEvent | AssessmentAnswerSubmittedEvent | MasteryVerificationStateChangedEvent | ExamSessionStateChangedEvent | ExamAntiCheatRecordedEvent | ReportGeneratedEvent | VocabularyReviewFilteredEvent | VocabularyExpressionCreatedEvent | GrammarPracticeCompletedEvent | WritingEvaluationCompletedEvent | ListeningDictationSubmittedEvent | ReadingProgressUpdatedEvent | SpeakingSelfRatingSubmittedEvent | OfflineSyncAppliedEvent | GrammarMasteryUpdatedEvent | ListeningProgressSavedEvent | SpeakingShadowingProgressedEvent | MediaOfflinePackageSyncedEvent | GamificationProfileUpdatedEvent | GamificationXpLedgerAppendedEvent | GamificationCurrencyLedgerAppendedEvent | GamificationStreakDayValidatedEvent | GamificationStreakRescueCompletedEvent | GamificationQuestProgressedEvent | GamificationQuestClaimedEvent | GamificationAchievementUnlockedEvent | GamificationChestGrantedEvent | GamificationChestOpenedEvent | GamificationAvatarLoadoutEquippedEvent | GamificationSeasonPointsUpdatedEvent | GamesSessionCreatedEvent | GamesSessionEventAcceptedEvent | GamesSessionCompletedEvent | SocialRoomJoinedEvent | SocialFocusStartedEvent | SocialFocusCompletedEvent | SocialInteractionSentEvent | OfflinePackageAuthorizedEvent | OfflineB4SyncAppliedEvent | SocialRoomLeftEvent | SocialFocusUpdatedEvent | SocialModerationReportedEvent | SocialModerationBlockedEvent | SocialModerationMutedEvent | NotificationsMessageReadEvent | NotificationsPreferencesUpdatedEvent | OfflinePackageDownloadStateUpdatedEvent | OfflineSyncConflictRecordedEvent | CommerceOrderCreatedEvent | CommercePaymentRequestedEvent | CommercePaymentCallbackReceivedEvent | CommercePaymentVerifiedEvent | CommerceRefundCompletedEvent | CommerceHouseholdChangedEvent | CmsContentVersionSavedEvent | CmsImportCompletedEvent | SafetyPrecheckBlockedEvent | RiskDecisionCreatedEvent | FinanceReconciliationDiscrepancyEvent | OpsFlagUpdatedEvent | SupportTicketCreatedEvent | SupportTicketResolvedEvent | PlatformBuildRegisteredEvent | PlatformCompatibilityCheckedEvent | PlatformPerformanceDegradedEvent | QualityE2eCompletedEvent | QualitySecurityScanCompletedEvent | QualityReliabilityCompletedEvent | ObservabilityAlertRaisedEvent | DataBackupDrillCompletedEvent | ReleaseGateEvaluatedEvent | AuthPrincipalMappedEvent | AuthSessionRotatedEvent | AuthSessionReplayDetectedEvent | AuthDeviceRevokedEvent | AuthConsentUpdatedEvent | AuthAdultGateRejectedEvent | IamPolicyVersionChangedEvent | LearnerProfileUpdatedEvent | LearnerTargetUpdatedEvent | LearnerFirstDayProjectedEvent | ContentVersionSubmittedEvent | ContentVersionReviewedEvent | ContentVersionPublishedEvent | ContentVersionUnpublishedEvent | ContentVersionRolledBackEvent | ContentPublicProjectionInvalidatedEvent | AssessmentAttemptSubmittedEvent | AssessmentAttemptAssessedEvent | AssessmentPlacementCompletedEvent | LearningMasteryProjectedEvent | LearningReviewScheduledEvent | WorkflowAssessmentLearningSagaStartedEvent | WorkflowAssessmentLearningSagaCompensatedEvent | WorkflowEventReplayedEvent | MediaStartedEvent | MediaSegmentCompletedEvent | MediaDownloadedEvent | MediaRevokedEvent | SyncEnqueuedEvent | SyncConflictDetectedB11Event | SyncRecoveredEvent | RecordingSavedEvent | SpeakingPermissionRequestedEvent | ShadowingCompletedEvent | GamificationSessionStartedEvent | GamificationXpLedgerPostedEvent | GamificationRewardGrantedEvent | GamificationAvatarEquippedEvent | StudyRoomJoinedEvent | StudyRoomFocusStartedEvent | StudyRoomLeftEvent | LeaderboardRefreshedEvent | SocialReportCreatedEvent | NotificationRequestedEvent | NotificationRetryScheduledEvent | NotificationRecoveryCompletedEvent | CommerceOrderReconciledEvent | AnalyticsMetricProjectedEvent | AnalyticsRecomputeRequestedEvent | IamSessionRevokedEvent | WorkflowOutboxPublishedEvent | WorkflowEventDeliveryFailedEvent | WorkflowEventDeadLetteredEvent | WorkflowEventReplayRequestedEvent | WorkflowEventOrderingDeferredEvent | WorkflowSagaCompensationRequestedEvent | WorkflowSagaManualRecoveryRequestedEvent | AuthAccountRegisteredEvent | AuthLoginSucceededEvent | AssessmentItemAssessedEvent | LearningMasteryProjectedB10Event | LearningReviewScheduledB10Event | LearningTaskCompletedM1014LearningTaskCompletedEvent | GamificationXpLedgerPostedM1014GamificationXpLedgerPostedEvent | GamificationRewardGrantedM1014GamificationRewardGrantedEvent | StudyRoomSeatJoinedEvent | StudyRoomFocusStartedM1014StudyRoomFocusStartedEvent | StudyRoomSeatLeftEvent | LeaderboardSnapshotPublishedEvent | SocialReportCreatedM1014SocialReportCreatedEvent | CommerceOrderCreatedM1015CommerceOrderCreatedEvent | CommercePaymentRequestedM1015CommercePaymentRequestedEvent | CommercePaymentCallbackReceivedM1015CommercePaymentCallbackReceivedEvent | CommercePaymentVerifiedM1015CommercePaymentVerifiedEvent | CommerceEntitlementActivatedM1015CommerceEntitlementActivatedEvent | CommerceEntitlementRevokedM1015CommerceEntitlementRevokedEvent | CommerceRefundSettledEvent | CommerceReconciliationDiscrepancyRecordedEvent | CommerceReconciliationRecoveryReceiptedEvent | NotificationRequestedM1016NotificationRequestedEvent | NotificationRetryScheduledM1016NotificationRetryScheduledEvent | NotificationRecoveryCompletedM1016NotificationRecoveryCompletedEvent | SyncCommandReceiptedEvent | SyncConflictDetectedM1016SyncConflictDetectedEvent | SyncRecoveredM1016SyncRecoveredEvent | SupportTicketCreatedM1016SupportTicketCreatedEvent | SupportTicketResolvedM1016SupportTicketResolvedEvent | PrivacyExportRequestedM1017PrivacyExportRequestedEvent | PrivacyExportCompletedM1017PrivacyExportCompletedEvent | AccountDeletionRequestedEvent | AccountDeletionCancelledEvent | AccountDeletionCompletedEvent | IamAccountBootstrapCreatedEvent | IamLearningEligibilityChangedEvent | IamPolicySecurityStateChangedEvent | LearningReportReadyEvent;

/** @deprecated Use CanonicalPlatformEvent for new v2 event publication. */
export type PlatformEvent = EventCatalogCandidate;

export const canonicalEventGovernance = {
  "learner.target.updated.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "learner-service",
      "dataOwner": "learner-service",
      "outboxRequired": true,
      "publishOperationId": "publish_learner_target_updated_v1"
    },
    "consumers": [
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-learner.v1",
        "subscriptionOperationId": "subscribe_learner_target_updated_v1_cg_learning_from_learner_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-learner.v1",
        "subscriptionOperationId": "subscribe_learner_target_updated_v1_cg_workflow_from_learner_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.learner.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.targetId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "learner_target_updated_v1"
    },
    "schema": {
      "schemaVersion": "learner.event.v1",
      "payloadRef": "#/payloadSchemas/B9LearnerTargetUpdated",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "content.version.submitted.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "content-service",
      "dataOwner": "content-service",
      "outboxRequired": true,
      "publishOperationId": "publish_content_version_submitted_v1"
    },
    "consumers": [
      {
        "service": "admin-ops-service",
        "consumerGroup": "cg.admin-ops-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_submitted_v1_cg_admin_ops_from_content_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_submitted_v1_cg_audit_from_content_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.content.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.contentVersionId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "content_version_submitted_v1"
    },
    "schema": {
      "schemaVersion": "content.event.v1",
      "payloadRef": "#/payloadSchemas/B9ContentVersionSubmitted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "content.version.reviewed.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "content-service",
      "dataOwner": "content-service",
      "outboxRequired": true,
      "publishOperationId": "publish_content_version_reviewed_v1"
    },
    "consumers": [
      {
        "service": "admin-ops-service",
        "consumerGroup": "cg.admin-ops-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_reviewed_v1_cg_admin_ops_from_content_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_reviewed_v1_cg_audit_from_content_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.content.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.contentVersionId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "content_version_reviewed_v1"
    },
    "schema": {
      "schemaVersion": "content.event.v1",
      "payloadRef": "#/payloadSchemas/B9ContentVersionReviewed",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "content.version.published.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "content-service",
      "dataOwner": "content-service",
      "outboxRequired": true,
      "publishOperationId": "publish_content_version_published_v1"
    },
    "consumers": [
      {
        "service": "learner-service",
        "consumerGroup": "cg.learner-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_published_v1_cg_learner_from_content_v1"
      },
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_published_v1_cg_learning_from_content_v1"
      },
      {
        "service": "assessment-service",
        "consumerGroup": "cg.assessment-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_published_v1_cg_assessment_from_content_v1"
      },
      {
        "service": "admin-ops-service",
        "consumerGroup": "cg.admin-ops-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_published_v1_cg_admin_ops_from_content_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_published_v1_cg_audit_from_content_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.content.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.contentVersionId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "content_version_published_v1"
    },
    "schema": {
      "schemaVersion": "content.event.v1",
      "payloadRef": "#/payloadSchemas/B9ContentVersionPublished",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "content.version.unpublished.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "content-service",
      "dataOwner": "content-service",
      "outboxRequired": true,
      "publishOperationId": "publish_content_version_unpublished_v1"
    },
    "consumers": [
      {
        "service": "learner-service",
        "consumerGroup": "cg.learner-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_unpublished_v1_cg_learner_from_content_v1"
      },
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_unpublished_v1_cg_learning_from_content_v1"
      },
      {
        "service": "assessment-service",
        "consumerGroup": "cg.assessment-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_unpublished_v1_cg_assessment_from_content_v1"
      },
      {
        "service": "admin-ops-service",
        "consumerGroup": "cg.admin-ops-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_unpublished_v1_cg_admin_ops_from_content_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_unpublished_v1_cg_audit_from_content_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.content.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.contentVersionId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "content_version_unpublished_v1"
    },
    "schema": {
      "schemaVersion": "content.event.v1",
      "payloadRef": "#/payloadSchemas/B9ContentVersionUnpublished",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "content.version.rolled_back.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "content-service",
      "dataOwner": "content-service",
      "outboxRequired": true,
      "publishOperationId": "publish_content_version_rolled_back_v1"
    },
    "consumers": [
      {
        "service": "learner-service",
        "consumerGroup": "cg.learner-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_rolled_back_v1_cg_learner_from_content_v1"
      },
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_rolled_back_v1_cg_learning_from_content_v1"
      },
      {
        "service": "assessment-service",
        "consumerGroup": "cg.assessment-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_rolled_back_v1_cg_assessment_from_content_v1"
      },
      {
        "service": "admin-ops-service",
        "consumerGroup": "cg.admin-ops-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_rolled_back_v1_cg_admin_ops_from_content_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-content.v1",
        "subscriptionOperationId": "subscribe_content_version_rolled_back_v1_cg_audit_from_content_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.content.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.contentCode",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "content_version_rolled_back_v1"
    },
    "schema": {
      "schemaVersion": "content.event.v1",
      "payloadRef": "#/payloadSchemas/B9ContentVersionRolledBack",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "assessment.placement.completed.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "assessment-service",
      "dataOwner": "assessment-service",
      "outboxRequired": true,
      "publishOperationId": "publish_assessment_placement_completed_v1"
    },
    "consumers": [
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-assessment.v1",
        "subscriptionOperationId": "subscribe_assessment_placement_completed_v1_cg_learning_from_assessment_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-assessment.v1",
        "subscriptionOperationId": "subscribe_assessment_placement_completed_v1_cg_workflow_from_assessment_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.assessment.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.sessionId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "assessment_placement_completed_v1"
    },
    "schema": {
      "schemaVersion": "assessment.event.v1",
      "payloadRef": "#/payloadSchemas/B10PlacementCompleted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "workflow.outbox.published.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "workflow-service",
      "dataOwner": "workflow-service",
      "outboxRequired": true,
      "publishOperationId": "publish_workflow_outbox_published_v1"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-reliability.v1",
        "subscriptionOperationId": "subscribe_workflow_outbox_published_v1_cg_workflow_reliability_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-workflow.v1",
        "subscriptionOperationId": "subscribe_workflow_outbox_published_v1_cg_audit_from_workflow_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.workflow.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.outboxId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "workflow_outbox_published_v1"
    },
    "schema": {
      "schemaVersion": "workflow.event.v1",
      "payloadRef": "#/payloadSchemas/B26WorkflowOutboxPublished",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "workflow.event.delivery_failed.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "workflow-service",
      "dataOwner": "workflow-service",
      "outboxRequired": true,
      "publishOperationId": "publish_workflow_event_delivery_failed_v1"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-reliability.v1",
        "subscriptionOperationId": "subscribe_workflow_event_delivery_failed_v1_cg_workflow_reliability_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-workflow.v1",
        "subscriptionOperationId": "subscribe_workflow_event_delivery_failed_v1_cg_audit_from_workflow_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.workflow.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.failedEventId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "workflow_event_delivery_failed_v1"
    },
    "schema": {
      "schemaVersion": "workflow.event.v1",
      "payloadRef": "#/payloadSchemas/B26WorkflowDeliveryFailed",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "workflow.event.dead_lettered.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "workflow-service",
      "dataOwner": "workflow-service",
      "outboxRequired": true,
      "publishOperationId": "publish_workflow_event_dead_lettered_v1"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-manual-recovery.v1",
        "subscriptionOperationId": "subscribe_workflow_event_dead_lettered_v1_cg_workflow_manual_recovery_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-workflow.v1",
        "subscriptionOperationId": "subscribe_workflow_event_dead_lettered_v1_cg_audit_from_workflow_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.workflow.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.failedEventId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "workflow_event_dead_lettered_v1"
    },
    "schema": {
      "schemaVersion": "workflow.event.v1",
      "payloadRef": "#/payloadSchemas/B26WorkflowDeadLettered",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "workflow.event.replay_requested.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "workflow-service",
      "dataOwner": "workflow-service",
      "outboxRequired": true,
      "publishOperationId": "publish_workflow_event_replay_requested_v1"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-reliability.v1",
        "subscriptionOperationId": "subscribe_workflow_event_replay_requested_v1_cg_workflow_reliability_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-manual-recovery.v1",
        "subscriptionOperationId": "subscribe_workflow_event_replay_requested_v1_cg_workflow_manual_recovery_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.workflow.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.replayRunId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "workflow_event_replay_requested_v1"
    },
    "schema": {
      "schemaVersion": "workflow.event.v1",
      "payloadRef": "#/payloadSchemas/B26WorkflowReplayRequested",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "workflow.event.ordering_deferred.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "workflow-service",
      "dataOwner": "workflow-service",
      "outboxRequired": true,
      "publishOperationId": "publish_workflow_event_ordering_deferred_v1"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-reliability.v1",
        "subscriptionOperationId": "subscribe_workflow_event_ordering_deferred_v1_cg_workflow_reliability_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-manual-recovery.v1",
        "subscriptionOperationId": "subscribe_workflow_event_ordering_deferred_v1_cg_workflow_manual_recovery_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.workflow.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.aggregateId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "workflow_event_ordering_deferred_v1"
    },
    "schema": {
      "schemaVersion": "workflow.event.v1",
      "payloadRef": "#/payloadSchemas/B26WorkflowOrderingDeferred",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "workflow.saga.compensation_requested.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "workflow-service",
      "dataOwner": "workflow-service",
      "outboxRequired": true,
      "publishOperationId": "publish_workflow_saga_compensation_requested_v1"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-reliability.v1",
        "subscriptionOperationId": "subscribe_workflow_saga_compensation_requested_v1_cg_workflow_reliability_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-workflow.v1",
        "subscriptionOperationId": "subscribe_workflow_saga_compensation_requested_v1_cg_audit_from_workflow_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.workflow.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.sagaId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "workflow_saga_compensation_requested_v1"
    },
    "schema": {
      "schemaVersion": "workflow.saga.v1",
      "payloadRef": "#/payloadSchemas/B26WorkflowCompensationRequested",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "workflow.saga.manual_recovery_requested.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "workflow-service",
      "dataOwner": "workflow-service",
      "outboxRequired": true,
      "publishOperationId": "publish_workflow_saga_manual_recovery_requested_v1"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-manual-recovery.v1",
        "subscriptionOperationId": "subscribe_workflow_saga_manual_recovery_requested_v1_cg_workflow_manual_recovery_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-workflow.v1",
        "subscriptionOperationId": "subscribe_workflow_saga_manual_recovery_requested_v1_cg_audit_from_workflow_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.workflow.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.recoveryId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "workflow_saga_manual_recovery_requested_v1"
    },
    "schema": {
      "schemaVersion": "workflow.saga.v1",
      "payloadRef": "#/payloadSchemas/B26WorkflowManualRecoveryRequested",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "assessment.item.assessed.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "assessment-service",
      "dataOwner": "assessment-service",
      "outboxRequired": true,
      "publishOperationId": "publish_assessment_item_assessed_v2"
    },
    "consumers": [
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-assessment.v1",
        "subscriptionOperationId": "subscribe_assessment_item_assessed_v2_cg_learning_from_assessment_v1"
      },
      {
        "service": "gamification-service",
        "consumerGroup": "cg.gamification-from-assessment.v1",
        "subscriptionOperationId": "subscribe_assessment_item_assessed_v2_cg_gamification_from_assessment_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-assessment.v1",
        "subscriptionOperationId": "subscribe_assessment_item_assessed_v2_cg_workflow_from_assessment_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.assessment.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.itemAssessmentId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "assessment_item_assessed_v2"
    },
    "schema": {
      "schemaVersion": "assessment.event.v2",
      "payloadRef": "#/payloadSchemas/B10AssessmentItemAssessedV2",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "learning.mastery.projected.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "learning-service",
      "dataOwner": "learning-service",
      "outboxRequired": true,
      "publishOperationId": "publish_learning_mastery_projected_v2"
    },
    "consumers": [
      {
        "service": "assessment-service",
        "consumerGroup": "cg.assessment-from-learning.v1",
        "subscriptionOperationId": "subscribe_learning_mastery_projected_v2_cg_assessment_from_learning_v1"
      },
      {
        "service": "gamification-service",
        "consumerGroup": "cg.gamification-from-learning.v1",
        "subscriptionOperationId": "subscribe_learning_mastery_projected_v2_cg_gamification_from_learning_v1"
      },
      {
        "service": "social-service",
        "consumerGroup": "cg.social-from-learning.v1",
        "subscriptionOperationId": "subscribe_learning_mastery_projected_v2_cg_social_from_learning_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-learning.v1",
        "subscriptionOperationId": "subscribe_learning_mastery_projected_v2_cg_workflow_from_learning_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.learning.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.projectionId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "learning_mastery_projected_v2"
    },
    "schema": {
      "schemaVersion": "learning.event.v2",
      "payloadRef": "#/payloadSchemas/B10LearningMasteryProjectedV2",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "learning.review.scheduled.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "learning-service",
      "dataOwner": "learning-service",
      "outboxRequired": true,
      "publishOperationId": "publish_learning_review_scheduled_v2"
    },
    "consumers": [
      {
        "service": "assessment-service",
        "consumerGroup": "cg.assessment-from-learning.v1",
        "subscriptionOperationId": "subscribe_learning_review_scheduled_v2_cg_assessment_from_learning_v1"
      },
      {
        "service": "notification-service",
        "consumerGroup": "cg.notification-from-learning.v1",
        "subscriptionOperationId": "subscribe_learning_review_scheduled_v2_cg_notification_from_learning_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-learning.v1",
        "subscriptionOperationId": "subscribe_learning_review_scheduled_v2_cg_workflow_from_learning_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.learning.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.queueItemId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "learning_review_scheduled_v2"
    },
    "schema": {
      "schemaVersion": "learning.event.v2",
      "payloadRef": "#/payloadSchemas/B10LearningReviewScheduledV2",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "learning.task.completed.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "learning-service",
      "dataOwner": "learning-service",
      "outboxRequired": true,
      "publishOperationId": "publish_learning_task_completed_v2"
    },
    "consumers": [
      {
        "service": "gamification-service",
        "consumerGroup": "cg.gamification-from-learning.v1",
        "subscriptionOperationId": "subscribe_learning_task_completed_v2_cg_gamification_from_learning_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-learning.v1",
        "subscriptionOperationId": "subscribe_learning_task_completed_v2_cg_workflow_from_learning_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.learning.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.completionId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "learning_task_completed_v2"
    },
    "schema": {
      "schemaVersion": "learning.event.v2",
      "payloadRef": "#/payloadSchemas/M1014LearningTaskCompleted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "gamification.xp.ledger_posted.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "gamification-service",
      "dataOwner": "gamification-service",
      "outboxRequired": true,
      "publishOperationId": "publish_gamification_xp_ledger_posted_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-gamification.v1",
        "subscriptionOperationId": "subscribe_gamification_xp_ledger_posted_v2_cg_workflow_from_gamification_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-gamification.v1",
        "subscriptionOperationId": "subscribe_gamification_xp_ledger_posted_v2_cg_audit_from_gamification_v1"
      },
      {
        "service": "social-service",
        "consumerGroup": "cg.social-from-gamification.v1",
        "subscriptionOperationId": "subscribe_gamification_xp_ledger_posted_v2_cg_social_from_gamification_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.gamification.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.ledgerEntryId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "gamification_xp_ledger_posted_v2"
    },
    "schema": {
      "schemaVersion": "gamification.event.v2",
      "payloadRef": "#/payloadSchemas/M1014GamificationXpLedgerPosted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "gamification.reward.granted.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "gamification-service",
      "dataOwner": "gamification-service",
      "outboxRequired": true,
      "publishOperationId": "publish_gamification_reward_granted_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-gamification.v1",
        "subscriptionOperationId": "subscribe_gamification_reward_granted_v2_cg_workflow_from_gamification_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-gamification.v1",
        "subscriptionOperationId": "subscribe_gamification_reward_granted_v2_cg_audit_from_gamification_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.gamification.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.grantId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "gamification_reward_granted_v2"
    },
    "schema": {
      "schemaVersion": "gamification.event.v2",
      "payloadRef": "#/payloadSchemas/M1014GamificationRewardGranted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "study_room.seat_joined.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "social-service",
      "dataOwner": "social-service",
      "outboxRequired": true,
      "publishOperationId": "publish_study_room_seat_joined_v2"
    },
    "consumers": [
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-social.v1",
        "subscriptionOperationId": "subscribe_study_room_seat_joined_v2_cg_analytics_from_social_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-social.v1",
        "subscriptionOperationId": "subscribe_study_room_seat_joined_v2_cg_workflow_from_social_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-social.v1",
        "subscriptionOperationId": "subscribe_study_room_seat_joined_v2_cg_audit_from_social_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.social.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.leaseId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "study_room_seat_joined_v2"
    },
    "schema": {
      "schemaVersion": "social.event.v2",
      "payloadRef": "#/payloadSchemas/M1014StudyRoomSeatJoined",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "study_room.focus_started.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "social-service",
      "dataOwner": "social-service",
      "outboxRequired": true,
      "publishOperationId": "publish_study_room_focus_started_v2"
    },
    "consumers": [
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-social.v1",
        "subscriptionOperationId": "subscribe_study_room_focus_started_v2_cg_analytics_from_social_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-social.v1",
        "subscriptionOperationId": "subscribe_study_room_focus_started_v2_cg_workflow_from_social_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-social.v1",
        "subscriptionOperationId": "subscribe_study_room_focus_started_v2_cg_audit_from_social_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.social.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.focusId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "study_room_focus_started_v2"
    },
    "schema": {
      "schemaVersion": "social.event.v2",
      "payloadRef": "#/payloadSchemas/M1014StudyRoomFocusStarted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "study_room.seat_left.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "social-service",
      "dataOwner": "social-service",
      "outboxRequired": true,
      "publishOperationId": "publish_study_room_seat_left_v2"
    },
    "consumers": [
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-social.v1",
        "subscriptionOperationId": "subscribe_study_room_seat_left_v2_cg_analytics_from_social_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-social.v1",
        "subscriptionOperationId": "subscribe_study_room_seat_left_v2_cg_workflow_from_social_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-social.v1",
        "subscriptionOperationId": "subscribe_study_room_seat_left_v2_cg_audit_from_social_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.social.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.leaseId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "study_room_seat_left_v2"
    },
    "schema": {
      "schemaVersion": "social.event.v2",
      "payloadRef": "#/payloadSchemas/M1014StudyRoomSeatLeft",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "leaderboard.snapshot_published.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "social-service",
      "dataOwner": "social-service",
      "outboxRequired": true,
      "publishOperationId": "publish_leaderboard_snapshot_published_v2"
    },
    "consumers": [
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-social.v1",
        "subscriptionOperationId": "subscribe_leaderboard_snapshot_published_v2_cg_analytics_from_social_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-social.v1",
        "subscriptionOperationId": "subscribe_leaderboard_snapshot_published_v2_cg_workflow_from_social_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-social.v1",
        "subscriptionOperationId": "subscribe_leaderboard_snapshot_published_v2_cg_audit_from_social_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.social.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.snapshotId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "leaderboard_snapshot_published_v2"
    },
    "schema": {
      "schemaVersion": "social.event.v2",
      "payloadRef": "#/payloadSchemas/M1014LeaderboardSnapshotPublished",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "social.report.created.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "social-service",
      "dataOwner": "social-service",
      "outboxRequired": true,
      "publishOperationId": "publish_social_report_created_v2"
    },
    "consumers": [
      {
        "service": "admin-ops-service",
        "consumerGroup": "cg.admin-ops-from-social.v1",
        "subscriptionOperationId": "subscribe_social_report_created_v2_cg_admin_ops_from_social_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-social.v1",
        "subscriptionOperationId": "subscribe_social_report_created_v2_cg_audit_from_social_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-social.v1",
        "subscriptionOperationId": "subscribe_social_report_created_v2_cg_workflow_from_social_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.social.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.reportId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "social_report_created_v2"
    },
    "schema": {
      "schemaVersion": "social.event.v2",
      "payloadRef": "#/payloadSchemas/M1014SocialReportCreated",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "commerce.order.created.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "commerce-service",
      "dataOwner": "commerce-service",
      "outboxRequired": true,
      "publishOperationId": "publish_commerce_order_created_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_order_created_v2_cg_workflow_from_commerce_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_order_created_v2_cg_audit_from_commerce_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.commerce.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.orderId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "commerce_order_created_v2"
    },
    "schema": {
      "schemaVersion": "commerce.event.v2",
      "payloadRef": "#/payloadSchemas/M1015CommerceOrderCreated",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "commerce.payment.requested.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "commerce-service",
      "dataOwner": "commerce-service",
      "outboxRequired": true,
      "publishOperationId": "publish_commerce_payment_requested_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_payment_requested_v2_cg_workflow_from_commerce_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_payment_requested_v2_cg_audit_from_commerce_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.commerce.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.paymentAttemptId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "commerce_payment_requested_v2"
    },
    "schema": {
      "schemaVersion": "commerce.event.v2",
      "payloadRef": "#/payloadSchemas/M1015CommercePaymentRequested",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "commerce.payment.callback_received.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "commerce-service",
      "dataOwner": "commerce-service",
      "outboxRequired": true,
      "publishOperationId": "publish_commerce_payment_callback_received_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_payment_callback_received_v2_cg_workflow_from_commerce_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_payment_callback_received_v2_cg_audit_from_commerce_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.commerce.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.callbackReceiptRef",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "commerce_payment_callback_received_v2"
    },
    "schema": {
      "schemaVersion": "commerce.event.v2",
      "payloadRef": "#/payloadSchemas/M1015CommercePaymentCallbackReceived",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "commerce.payment.verified.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "commerce-service",
      "dataOwner": "commerce-service",
      "outboxRequired": true,
      "publishOperationId": "publish_commerce_payment_verified_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_payment_verified_v2_cg_workflow_from_commerce_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_payment_verified_v2_cg_audit_from_commerce_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.commerce.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.paymentAttemptId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "commerce_payment_verified_v2"
    },
    "schema": {
      "schemaVersion": "commerce.event.v2",
      "payloadRef": "#/payloadSchemas/M1015CommercePaymentVerified",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "commerce.entitlement.activated.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "commerce-service",
      "dataOwner": "commerce-service",
      "outboxRequired": true,
      "publishOperationId": "publish_commerce_entitlement_activated_v2"
    },
    "consumers": [
      {
        "service": "content-service",
        "consumerGroup": "cg.content-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_entitlement_activated_v2_cg_content_from_commerce_v1"
      },
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_entitlement_activated_v2_cg_learning_from_commerce_v1"
      },
      {
        "service": "notification-service",
        "consumerGroup": "cg.notification-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_entitlement_activated_v2_cg_notification_from_commerce_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_entitlement_activated_v2_cg_audit_from_commerce_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.commerce.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.entitlementId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "commerce_entitlement_activated_v2"
    },
    "schema": {
      "schemaVersion": "commerce.event.v2",
      "payloadRef": "#/payloadSchemas/M1015CommerceEntitlementActivated",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "commerce.entitlement.revoked.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "commerce-service",
      "dataOwner": "commerce-service",
      "outboxRequired": true,
      "publishOperationId": "publish_commerce_entitlement_revoked_v2"
    },
    "consumers": [
      {
        "service": "content-service",
        "consumerGroup": "cg.content-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_entitlement_revoked_v2_cg_content_from_commerce_v1"
      },
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_entitlement_revoked_v2_cg_learning_from_commerce_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_entitlement_revoked_v2_cg_audit_from_commerce_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.commerce.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.entitlementId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "commerce_entitlement_revoked_v2"
    },
    "schema": {
      "schemaVersion": "commerce.event.v2",
      "payloadRef": "#/payloadSchemas/M1015CommerceEntitlementRevoked",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "commerce.refund.settled.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "commerce-service",
      "dataOwner": "commerce-service",
      "outboxRequired": true,
      "publishOperationId": "publish_commerce_refund_settled_v2"
    },
    "consumers": [
      {
        "service": "content-service",
        "consumerGroup": "cg.content-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_refund_settled_v2_cg_content_from_commerce_v1"
      },
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_refund_settled_v2_cg_learning_from_commerce_v1"
      },
      {
        "service": "notification-service",
        "consumerGroup": "cg.notification-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_refund_settled_v2_cg_notification_from_commerce_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_refund_settled_v2_cg_audit_from_commerce_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.commerce.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.refundId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "commerce_refund_settled_v2"
    },
    "schema": {
      "schemaVersion": "commerce.event.v2",
      "payloadRef": "#/payloadSchemas/M1015CommerceRefundSettled",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "commerce.reconciliation.discrepancy_recorded.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "commerce-service",
      "dataOwner": "commerce-service",
      "outboxRequired": true,
      "publishOperationId": "publish_commerce_reconciliation_discrepancy_recorded_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_reconciliation_discrepancy_recorded_v2_cg_workflow_from_commerce_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_reconciliation_discrepancy_recorded_v2_cg_audit_from_commerce_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.commerce.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.reconciliationCaseRef",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "commerce_reconciliation_discrepancy_recorded_v2"
    },
    "schema": {
      "schemaVersion": "commerce.event.v2",
      "payloadRef": "#/payloadSchemas/M1015CommerceReconciliationDiscrepancyRecorded",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "commerce.reconciliation.recovery_receipted.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "commerce-service",
      "dataOwner": "commerce-service",
      "outboxRequired": true,
      "publishOperationId": "publish_commerce_reconciliation_recovery_receipted_v2"
    },
    "consumers": [
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-commerce.v1",
        "subscriptionOperationId": "subscribe_commerce_reconciliation_recovery_receipted_v2_cg_audit_from_commerce_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.commerce.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.reconciliationCaseRef",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "commerce_reconciliation_recovery_receipted_v2"
    },
    "schema": {
      "schemaVersion": "commerce.event.v2",
      "payloadRef": "#/payloadSchemas/M1015CommerceReconciliationRecoveryReceipted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  },
  "notification.requested.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "notification-service",
      "dataOwner": "notification-service",
      "outboxRequired": true,
      "publishOperationId": "publish_notification_requested_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-notification.v1",
        "subscriptionOperationId": "subscribe_notification_requested_v2_cg_workflow_from_notification_v1"
      },
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-notification.v1",
        "subscriptionOperationId": "subscribe_notification_requested_v2_cg_analytics_from_notification_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.notification.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.notificationId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "notification_requested_v2"
    },
    "schema": {
      "schemaVersion": "notification.event.v2",
      "payloadRef": "#/payloadSchemas/M1016NotificationRequested",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-013"
    ]
  },
  "notification.retry_scheduled.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "notification-service",
      "dataOwner": "notification-service",
      "outboxRequired": true,
      "publishOperationId": "publish_notification_retry_scheduled_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-notification.v1",
        "subscriptionOperationId": "subscribe_notification_retry_scheduled_v2_cg_workflow_from_notification_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.notification.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.notificationId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "notification_retry_scheduled_v2"
    },
    "schema": {
      "schemaVersion": "notification.event.v2",
      "payloadRef": "#/payloadSchemas/M1016NotificationRetryScheduled",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-013"
    ]
  },
  "notification.recovery.completed.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "notification-service",
      "dataOwner": "notification-service",
      "outboxRequired": true,
      "publishOperationId": "publish_notification_recovery_completed_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-notification.v1",
        "subscriptionOperationId": "subscribe_notification_recovery_completed_v2_cg_workflow_from_notification_v1"
      },
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-notification.v1",
        "subscriptionOperationId": "subscribe_notification_recovery_completed_v2_cg_analytics_from_notification_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.notification.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.notificationId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "notification_recovery_completed_v2"
    },
    "schema": {
      "schemaVersion": "notification.event.v2",
      "payloadRef": "#/payloadSchemas/M1016NotificationRecoveryCompleted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-013"
    ]
  },
  "sync.command_receipted.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "learning-service",
      "dataOwner": "learning-service",
      "outboxRequired": true,
      "publishOperationId": "publish_sync_command_receipted_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-learning.v1",
        "subscriptionOperationId": "subscribe_sync_command_receipted_v2_cg_workflow_from_learning_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.learning.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.clientEventId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "sync_command_receipted_v2"
    },
    "schema": {
      "schemaVersion": "learning.event.v2",
      "payloadRef": "#/payloadSchemas/M1016SyncCommandReceipted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-014"
    ]
  },
  "sync.conflict_detected.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "learning-service",
      "dataOwner": "learning-service",
      "outboxRequired": true,
      "publishOperationId": "publish_sync_conflict_detected_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-learning.v1",
        "subscriptionOperationId": "subscribe_sync_conflict_detected_v2_cg_workflow_from_learning_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.learning.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.conflictId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "sync_conflict_detected_v2"
    },
    "schema": {
      "schemaVersion": "learning.event.v2",
      "payloadRef": "#/payloadSchemas/M1016SyncConflictDetected",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-014"
    ]
  },
  "sync.recovered.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "learning-service",
      "dataOwner": "learning-service",
      "outboxRequired": true,
      "publishOperationId": "publish_sync_recovered_v2"
    },
    "consumers": [
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-learning.v1",
        "subscriptionOperationId": "subscribe_sync_recovered_v2_cg_workflow_from_learning_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.learning.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.conflictId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "sync_recovered_v2"
    },
    "schema": {
      "schemaVersion": "learning.event.v2",
      "payloadRef": "#/payloadSchemas/M1016SyncRecovered",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-014"
    ]
  },
  "support.ticket.created.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "admin-ops-service",
      "dataOwner": "admin-ops-service",
      "outboxRequired": true,
      "publishOperationId": "publish_support_ticket_created_v2"
    },
    "consumers": [
      {
        "service": "notification-service",
        "consumerGroup": "cg.notification-from-admin-ops.v1",
        "subscriptionOperationId": "subscribe_support_ticket_created_v2_cg_notification_from_admin_ops_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-admin-ops.v1",
        "subscriptionOperationId": "subscribe_support_ticket_created_v2_cg_workflow_from_admin_ops_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-admin-ops.v1",
        "subscriptionOperationId": "subscribe_support_ticket_created_v2_cg_audit_from_admin_ops_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.admin-ops.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.ticketId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "support_ticket_created_v2"
    },
    "schema": {
      "schemaVersion": "support.event.v2",
      "payloadRef": "#/payloadSchemas/M1016SupportTicketCreated",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-012"
    ]
  },
  "support.ticket.resolved.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "admin-ops-service",
      "dataOwner": "admin-ops-service",
      "outboxRequired": true,
      "publishOperationId": "publish_support_ticket_resolved_v2"
    },
    "consumers": [
      {
        "service": "notification-service",
        "consumerGroup": "cg.notification-from-admin-ops.v1",
        "subscriptionOperationId": "subscribe_support_ticket_resolved_v2_cg_notification_from_admin_ops_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-admin-ops.v1",
        "subscriptionOperationId": "subscribe_support_ticket_resolved_v2_cg_workflow_from_admin_ops_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-admin-ops.v1",
        "subscriptionOperationId": "subscribe_support_ticket_resolved_v2_cg_audit_from_admin_ops_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.admin-ops.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.ticketId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "support_ticket_resolved_v2"
    },
    "schema": {
      "schemaVersion": "support.event.v2",
      "payloadRef": "#/payloadSchemas/M1016SupportTicketResolved",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-012"
    ]
  },
  "privacy.export.requested.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "learner-service",
      "dataOwner": "learner-service",
      "outboxRequired": true,
      "publishOperationId": "publish_privacy_export_requested_v2"
    },
    "consumers": [
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-learner.v1",
        "subscriptionOperationId": "subscribe_privacy_export_requested_v2_cg_audit_from_learner_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-learner.v1",
        "subscriptionOperationId": "subscribe_privacy_export_requested_v2_cg_workflow_from_learner_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.learner.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.exportId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "privacy_export_requested_v2"
    },
    "schema": {
      "schemaVersion": "privacy.event.v2",
      "payloadRef": "#/payloadSchemas/M1017PrivacyExportRequested",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-015"
    ]
  },
  "privacy.export.completed.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "learner-service",
      "dataOwner": "learner-service",
      "outboxRequired": true,
      "publishOperationId": "publish_privacy_export_completed_v2"
    },
    "consumers": [
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-learner.v1",
        "subscriptionOperationId": "subscribe_privacy_export_completed_v2_cg_audit_from_learner_v1"
      },
      {
        "service": "notification-service",
        "consumerGroup": "cg.notification-from-learner.v1",
        "subscriptionOperationId": "subscribe_privacy_export_completed_v2_cg_notification_from_learner_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.learner.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.exportId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "privacy_export_completed_v2"
    },
    "schema": {
      "schemaVersion": "privacy.event.v2",
      "payloadRef": "#/payloadSchemas/M1017PrivacyExportCompleted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-015"
    ]
  },
  "account.deletion.requested.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "iam-service",
      "dataOwner": "iam-service",
      "outboxRequired": true,
      "publishOperationId": "publish_account_deletion_requested_v2"
    },
    "consumers": [
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-iam.v1",
        "subscriptionOperationId": "subscribe_account_deletion_requested_v2_cg_analytics_from_iam_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-iam.v1",
        "subscriptionOperationId": "subscribe_account_deletion_requested_v2_cg_audit_from_iam_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-iam.v1",
        "subscriptionOperationId": "subscribe_account_deletion_requested_v2_cg_workflow_from_iam_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.iam.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.deletionRequestId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "account_deletion_requested_v2"
    },
    "schema": {
      "schemaVersion": "iam.event.v2",
      "payloadRef": "#/payloadSchemas/M1017AccountDeletionRequested",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-016"
    ]
  },
  "account.deletion.cancelled.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "iam-service",
      "dataOwner": "iam-service",
      "outboxRequired": true,
      "publishOperationId": "publish_account_deletion_cancelled_v2"
    },
    "consumers": [
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-iam.v1",
        "subscriptionOperationId": "subscribe_account_deletion_cancelled_v2_cg_analytics_from_iam_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-iam.v1",
        "subscriptionOperationId": "subscribe_account_deletion_cancelled_v2_cg_audit_from_iam_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-iam.v1",
        "subscriptionOperationId": "subscribe_account_deletion_cancelled_v2_cg_workflow_from_iam_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.iam.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.deletionRequestId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "account_deletion_cancelled_v2"
    },
    "schema": {
      "schemaVersion": "iam.event.v2",
      "payloadRef": "#/payloadSchemas/M1017AccountDeletionCancelled",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-016"
    ]
  },
  "account.deletion.completed.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "iam-service",
      "dataOwner": "iam-service",
      "outboxRequired": true,
      "publishOperationId": "publish_account_deletion_completed_v2"
    },
    "consumers": [
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-iam.v1",
        "subscriptionOperationId": "subscribe_account_deletion_completed_v2_cg_analytics_from_iam_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-iam.v1",
        "subscriptionOperationId": "subscribe_account_deletion_completed_v2_cg_audit_from_iam_v1"
      },
      {
        "service": "notification-service",
        "consumerGroup": "cg.notification-from-iam.v1",
        "subscriptionOperationId": "subscribe_account_deletion_completed_v2_cg_notification_from_iam_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.iam.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.deletionRequestId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "account_deletion_completed_v2"
    },
    "schema": {
      "schemaVersion": "iam.event.v2",
      "payloadRef": "#/payloadSchemas/M1017AccountDeletionCompleted",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-016"
    ]
  },
  "iam.account.bootstrap.created.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "iam-service",
      "dataOwner": "iam-service",
      "outboxRequired": true,
      "publishOperationId": "publish_iam_account_bootstrap_created_v2"
    },
    "consumers": [
      {
        "service": "learner-service",
        "consumerGroup": "cg.learner-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_account_bootstrap_created_v2_cg_learner_from_iam_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.iam.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.principalId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "iam_account_bootstrap_created_v2"
    },
    "schema": {
      "schemaVersion": "iam.event.v2",
      "payloadRef": "#/payloadSchemas/M1018IamAccountBootstrapCreated",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-001"
    ]
  },
  "iam.learning_eligibility.changed.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "iam-service",
      "dataOwner": "iam-service",
      "outboxRequired": true,
      "publishOperationId": "publish_iam_learning_eligibility_changed_v2"
    },
    "consumers": [
      {
        "service": "learner-service",
        "consumerGroup": "cg.learner-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_learning_eligibility_changed_v2_cg_learner_from_iam_v1"
      },
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_learning_eligibility_changed_v2_cg_learning_from_iam_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.iam.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.principalId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "iam_learning_eligibility_changed_v2"
    },
    "schema": {
      "schemaVersion": "iam.event.v2",
      "payloadRef": "#/payloadSchemas/M1018IamLearningEligibilityChanged",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-002"
    ]
  },
  "iam.policy.security_state_changed.v2": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "iam-service",
      "dataOwner": "iam-service",
      "outboxRequired": true,
      "publishOperationId": "publish_iam_policy_security_state_changed_v2"
    },
    "consumers": [
      {
        "service": "admin-ops-service",
        "consumerGroup": "cg.admin-ops-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_admin_ops_from_iam_v1"
      },
      {
        "service": "analytics-service",
        "consumerGroup": "cg.analytics-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_analytics_from_iam_v1"
      },
      {
        "service": "assessment-service",
        "consumerGroup": "cg.assessment-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_assessment_from_iam_v1"
      },
      {
        "service": "audit-service",
        "consumerGroup": "cg.audit-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_audit_from_iam_v1"
      },
      {
        "service": "commerce-service",
        "consumerGroup": "cg.commerce-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_commerce_from_iam_v1"
      },
      {
        "service": "content-service",
        "consumerGroup": "cg.content-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_content_from_iam_v1"
      },
      {
        "service": "gamification-service",
        "consumerGroup": "cg.gamification-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_gamification_from_iam_v1"
      },
      {
        "service": "learner-service",
        "consumerGroup": "cg.learner-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_learner_from_iam_v1"
      },
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_learning_from_iam_v1"
      },
      {
        "service": "media-service",
        "consumerGroup": "cg.media-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_media_from_iam_v1"
      },
      {
        "service": "notification-service",
        "consumerGroup": "cg.notification-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_notification_from_iam_v1"
      },
      {
        "service": "social-service",
        "consumerGroup": "cg.social-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_social_from_iam_v1"
      },
      {
        "service": "workflow-service",
        "consumerGroup": "cg.workflow-from-iam.v1",
        "subscriptionOperationId": "subscribe_iam_policy_security_state_changed_v2_cg_workflow_from_iam_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.iam.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.policyVersionId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "iam_policy_security_state_changed_v2"
    },
    "schema": {
      "schemaVersion": "iam.event.v2",
      "payloadRef": "#/payloadSchemas/M1018IamPolicySecurityStateChanged",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-001",
      "INT-P1-002"
    ]
  },
  "learning.report.ready.v1": {
    "status": "CANONICAL_D2",
    "runtimeStatus": "NOT_RUNTIME_VERIFIED",
    "scope": "CROSS_SERVICE_INTEGRATION_FACT",
    "producer": {
      "service": "assessment-service",
      "dataOwner": "assessment-service",
      "outboxRequired": true,
      "publishOperationId": "publish_learning_report_ready_v1"
    },
    "consumers": [
      {
        "service": "learning-service",
        "consumerGroup": "cg.learning-from-assessment.v1",
        "subscriptionOperationId": "subscribe_learning_report_ready_v1_cg_learning_from_assessment_v1"
      },
      {
        "service": "gamification-service",
        "consumerGroup": "cg.gamification-from-assessment.v1",
        "subscriptionOperationId": "subscribe_learning_report_ready_v1_cg_gamification_from_assessment_v1"
      }
    ],
    "transport": {
      "protocol": "kafka",
      "topic": "platform.assessment.v1",
      "partitionKey": "aggregateId",
      "aggregateIdSource": "payload.reportId",
      "delivery": "at-least-once",
      "bindingVersion": "0.5.0",
      "channelId": "learning_report_ready_v1"
    },
    "schema": {
      "schemaVersion": "learning.event.v1",
      "payloadRef": "#/payloadSchemas/B10LearningReportReadyV1",
      "compatibility": "additive"
    },
    "correlation": [
      "eventId",
      "aggregateId",
      "requestId",
      "traceId",
      "dedupeKey"
    ],
    "traceability": [
      "ARCH-EVT-001",
      "INT-P1-017"
    ]
  }
} as const;

export type CanonicalEventName = keyof typeof canonicalEventGovernance;
export type CanonicalPlatformEvent = LearnerTargetUpdatedEvent | ContentVersionSubmittedEvent | ContentVersionReviewedEvent | ContentVersionPublishedEvent | ContentVersionUnpublishedEvent | ContentVersionRolledBackEvent | AssessmentPlacementCompletedEvent | WorkflowOutboxPublishedEvent | WorkflowEventDeliveryFailedEvent | WorkflowEventDeadLetteredEvent | WorkflowEventReplayRequestedEvent | WorkflowEventOrderingDeferredEvent | WorkflowSagaCompensationRequestedEvent | WorkflowSagaManualRecoveryRequestedEvent | AssessmentItemAssessedEvent | LearningMasteryProjectedB10Event | LearningReviewScheduledB10Event | LearningTaskCompletedM1014LearningTaskCompletedEvent | GamificationXpLedgerPostedM1014GamificationXpLedgerPostedEvent | GamificationRewardGrantedM1014GamificationRewardGrantedEvent | StudyRoomSeatJoinedEvent | StudyRoomFocusStartedM1014StudyRoomFocusStartedEvent | StudyRoomSeatLeftEvent | LeaderboardSnapshotPublishedEvent | SocialReportCreatedM1014SocialReportCreatedEvent | CommerceOrderCreatedM1015CommerceOrderCreatedEvent | CommercePaymentRequestedM1015CommercePaymentRequestedEvent | CommercePaymentCallbackReceivedM1015CommercePaymentCallbackReceivedEvent | CommercePaymentVerifiedM1015CommercePaymentVerifiedEvent | CommerceEntitlementActivatedM1015CommerceEntitlementActivatedEvent | CommerceEntitlementRevokedM1015CommerceEntitlementRevokedEvent | CommerceRefundSettledEvent | CommerceReconciliationDiscrepancyRecordedEvent | CommerceReconciliationRecoveryReceiptedEvent | NotificationRequestedM1016NotificationRequestedEvent | NotificationRetryScheduledM1016NotificationRetryScheduledEvent | NotificationRecoveryCompletedM1016NotificationRecoveryCompletedEvent | SyncCommandReceiptedEvent | SyncConflictDetectedM1016SyncConflictDetectedEvent | SyncRecoveredM1016SyncRecoveredEvent | SupportTicketCreatedM1016SupportTicketCreatedEvent | SupportTicketResolvedM1016SupportTicketResolvedEvent | PrivacyExportRequestedM1017PrivacyExportRequestedEvent | PrivacyExportCompletedM1017PrivacyExportCompletedEvent | AccountDeletionRequestedEvent | AccountDeletionCancelledEvent | AccountDeletionCompletedEvent | IamAccountBootstrapCreatedEvent | IamLearningEligibilityChangedEvent | IamPolicySecurityStateChangedEvent | LearningReportReadyEvent;
