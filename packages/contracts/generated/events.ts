/* eslint-disable */
// GENERATED FILE. Source: packages/contracts/events/v1/catalog.json
// Run node scripts/contracts/generate-contracts.mjs after changing the source.

export interface PlatformEventEnvelope<TPayload> {
  eventId: string;
  eventName: string;
  schema: "platform.event.v1";
  version: number;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string;
  actorId: string;
  traceId: string;
  requestId: string;
  schemaVersion?: string;
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
export type CommerceEntitlementActivated = { entitlementId: number; userId: number; orderId?: number; planCode: string; startsAt: string; endsAt: string; status: "ACTIVE"; };

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
export type NotificationDelivered = { notificationId: number; userId: number; channel: "IN_APP" | "PUSH" | "SMS" | "EMAIL"; status: "DELIVERED" | "SKIPPED" | "FAILED"; deliveredAt: string; providerCode?: string; };

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
export type B9LearnerProfileUpdated = { tenantId: string; principalId: string; profileVersion: number; changedFieldCodes: ReadonlyArray<string>; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9LearnerTargetUpdated = { tenantId: string; principalId: string; targetId: number; targetVersion: number; goalCode: string; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; dailyQuotaMinutes: 5 | 15 | 30 | 45; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9LearnerFirstDayProjected = { tenantId: string; principalId: string; projectionVersion: number; contentEpoch: number; readiness: "NOT_READY" | "READY" | "DEGRADED"; taskCount: number; projectedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentVersionSubmitted = { tenantId: string; contentCode: string; contentType: "COURSE" | "COURSE_UNIT" | "VOCABULARY" | "PHRASE" | "GRAMMAR" | "SENTENCE" | "QUESTION"; contentVersionId: number; versionNumber: number; stateVersion: number; submittedAt: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentVersionReviewed = { tenantId: string; contentCode: string; contentVersionId: number; versionNumber: number; reviewStage: "FIRST_REVIEW" | "FINAL_REVIEW"; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewVersion: number; reviewedAt: string; };

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
export type B10AssessmentAttemptSubmitted = { tenantId: string; principalId: string; attemptId: string; sessionId: string; contentVersionId: number; contentSnapshotId: string; contentEpoch: number; attemptVersion: number; submissionDigest: string; itemCount: number; gradingRuleVersion: string; submittedAt: string; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentAttemptAssessed = { tenantId: string; principalId: string; attemptId: string; sessionId: string; contentVersionId: number; contentSnapshotId: string; attemptVersion: number; assessmentVersion: string; scoreBucket: "ZERO" | "PARTIAL" | "FULL" | "PENDING_REVIEW"; masterySignal: "NO_SIGNAL" | "WEAK" | "STABLE" | "MASTERED" | "RETRY"; mistakeCodes: ReadonlyArray<string>; assessedAt: string; };

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
export type B13CommerceOrderCreated = { orderId: string; skuId: string; priceSnapshotId: string; amountMinor: number; currency: string; state: "CREATED" | "PENDING_PAYMENT" | "PAYMENT_PENDING"; };

/**
 * Generated from the contract source.
 */
export type B13CommercePaymentCallback = { providerEventRef: string; orderRef: string; callbackState: "VERIFIED_PAID" | "VERIFIED_REFUNDED" | "REJECTED"; amountMinor: number; currency: string; verificationRef: string; };

/**
 * Generated from the contract source.
 */
export type B13CommerceEntitlementActivated = { entitlementId: string; entitlementCode: string; sourceRef: string; startsAt: string; expiresAt: unknown; activationReason: "VERIFIED_PAYMENT" | "ACTIVATION_CODE"; };

/**
 * Generated from the contract source.
 */
export type B13CommerceRefundCompleted = { refundId: string; orderRef: string; state: "SUCCEEDED" | "REJECTED"; amountMinor: number; currency: string; completedAt: string; };

/**
 * Generated from the contract source.
 */
export type B13CommerceOrderReconciled = { batchRef: string; provider: string; differenceCount: number; state: "MATCHED" | "DIFF_FOUND" | "REPLAYED"; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type B13SupportTicketCreated = { ticketId: string; categoryCode: string; priority: string; slaDueAt: string; redactionVersion: string; };

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
export type B26WorkflowDeliveryFailed = { failedEventId: string; consumerGroup: string; failureCode: "TIMEOUT" | "TEMPORARY_UNAVAILABLE" | "CONFLICT_RETRYABLE" | "SCHEMA_INVALID" | "FORBIDDEN" | "OWNER_MISMATCH" | "STALE_VERSION"; retryable: boolean; attempt: number; failedAt: string; nextAttemptAt?: unknown; };

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

export interface LearningSrsBatchCreatedEvent extends PlatformEventEnvelope<LearningSrsBatchCreated> {
  eventName: "learning.srs.batch_created.v1";
  version: 1;
}

export interface VocabularyReviewAcceptedEvent extends PlatformEventEnvelope<VocabularyReviewAccepted> {
  eventName: "vocabulary.review.accepted.v1";
  version: 1;
}

export interface VocabularySrsStateChangedEvent extends PlatformEventEnvelope<VocabularySrsStateChanged> {
  eventName: "vocabulary.srs.state_changed.v1";
  version: 1;
}

export interface AssessmentAnswerScoredEvent extends PlatformEventEnvelope<AssessmentAnswerScored> {
  eventName: "assessment.answer_scored.v1";
  version: 1;
}

export interface MasteryStateChangedEvent extends PlatformEventEnvelope<MasteryStateChanged> {
  eventName: "mastery.state_changed.v1";
  version: 1;
}

export interface LearningTaskCompletedEvent extends PlatformEventEnvelope<LearningTaskCompleted> {
  eventName: "learning.task.completed.v1";
  version: 1;
}

export interface CmsContentSubmittedEvent extends PlatformEventEnvelope<CmsContentSubmitted> {
  eventName: "cms.content.submitted.v1";
  version: 1;
}

export interface CmsReviewDecidedEvent extends PlatformEventEnvelope<CmsReviewDecided> {
  eventName: "cms.review.decided.v1";
  version: 1;
}

export interface CmsContentPublishedEvent extends PlatformEventEnvelope<CmsContentPublished> {
  eventName: "cms.content.published.v1";
  version: 1;
}

export interface CmsContentRolledBackEvent extends PlatformEventEnvelope<CmsContentRolledBack> {
  eventName: "cms.content.rolled_back.v1";
  version: 1;
}

export interface CommerceOrderPaidEvent extends PlatformEventEnvelope<CommerceOrderPaid> {
  eventName: "commerce.order.paid.v1";
  version: 1;
}

export interface CommerceEntitlementActivatedEvent extends PlatformEventEnvelope<B13CommerceEntitlementActivated> {
  eventName: "commerce.entitlement.activated.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface CommerceEntitlementRevokedEvent extends PlatformEventEnvelope<CommerceEntitlementRevoked> {
  eventName: "commerce.entitlement.revoked.v1";
  version: 1;
}

export interface CommerceSubscriptionChangedEvent extends PlatformEventEnvelope<CommerceSubscriptionChanged> {
  eventName: "commerce.subscription.changed.v1";
  version: 1;
}

export interface NotificationCreatedEvent extends PlatformEventEnvelope<NotificationCreated> {
  eventName: "notification.created.v1";
  version: 1;
}

export interface NotificationDeliveredEvent extends PlatformEventEnvelope<B11NotificationDelivered> {
  eventName: "notification.delivered.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface NotificationReadEvent extends PlatformEventEnvelope<NotificationRead> {
  eventName: "notification.read.v1";
  version: 1;
}

export interface SyncLearningCheckpointSavedEvent extends PlatformEventEnvelope<SyncLearningCheckpointSaved> {
  eventName: "sync.learning.checkpoint_saved.v1";
  version: 1;
}

export interface SyncConflictDetectedEvent extends PlatformEventEnvelope<SyncConflictDetected> {
  eventName: "sync.conflict.detected.v1";
  version: 1;
}

export interface SyncCursorAdvancedEvent extends PlatformEventEnvelope<SyncCursorAdvanced> {
  eventName: "sync.cursor.advanced.v1";
  version: 1;
}

export interface AuthSessionRevokedEvent extends PlatformEventEnvelope<AuthSessionRevoked> {
  eventName: "auth.session.revoked.v1";
  version: 1;
}

export interface AssessmentItemSubmittedEvent extends PlatformEventEnvelope<AssessmentItemSubmitted> {
  eventName: "assessment.item.submitted.v1";
  version: 1;
}

export interface AuthDeviceKickedEvent extends PlatformEventEnvelope<AuthDeviceKicked> {
  eventName: "auth.device.kicked.v1";
  version: 1;
}

export interface PrivacyExportRequestedEvent extends PlatformEventEnvelope<PrivacyExportRequested> {
  eventName: "privacy.export.requested.v1";
  version: 1;
}

export interface PrivacyExportCompletedEvent extends PlatformEventEnvelope<PrivacyExportCompleted> {
  eventName: "privacy.export.completed.v1";
  version: 1;
}

export interface AssessmentStreamBuiltEvent extends PlatformEventEnvelope<AssessmentStreamBuilt> {
  eventName: "assessment.stream_built.v1";
  version: 1;
}

export interface AssessmentAnswerSubmittedEvent extends PlatformEventEnvelope<AssessmentAnswerSubmitted> {
  eventName: "assessment.answer_submitted.v1";
  version: 1;
}

export interface MasteryVerificationStateChangedEvent extends PlatformEventEnvelope<MasteryVerificationStateChanged> {
  eventName: "mastery.verification_state_changed.v1";
  version: 1;
}

export interface ExamSessionStateChangedEvent extends PlatformEventEnvelope<ExamSessionStateChanged> {
  eventName: "exam.session_state_changed.v1";
  version: 1;
}

export interface ExamAntiCheatRecordedEvent extends PlatformEventEnvelope<ExamAntiCheatRecorded> {
  eventName: "exam.anti_cheat_recorded.v1";
  version: 1;
}

export interface ReportGeneratedEvent extends PlatformEventEnvelope<ReportGenerated> {
  eventName: "report.generated.v1";
  version: 1;
}

export interface VocabularyReviewFilteredEvent extends PlatformEventEnvelope<VocabularyReviewFiltered> {
  eventName: "vocabulary.review.filtered.v1";
  version: 1;
}

export interface VocabularyExpressionCreatedEvent extends PlatformEventEnvelope<VocabularyExpressionCreated> {
  eventName: "vocabulary.expression.created.v1";
  version: 1;
}

export interface GrammarPracticeCompletedEvent extends PlatformEventEnvelope<GrammarPracticeCompleted> {
  eventName: "grammar.practice.completed.v1";
  version: 1;
}

export interface WritingEvaluationCompletedEvent extends PlatformEventEnvelope<WritingEvaluationCompleted> {
  eventName: "writing.evaluation.completed.v1";
  version: 1;
}

export interface ListeningDictationSubmittedEvent extends PlatformEventEnvelope<ListeningDictationSubmitted> {
  eventName: "listening.dictation.submitted.v1";
  version: 1;
}

export interface ReadingProgressUpdatedEvent extends PlatformEventEnvelope<ReadingProgressUpdated> {
  eventName: "reading.progress.updated.v1";
  version: 1;
}

export interface SpeakingSelfRatingSubmittedEvent extends PlatformEventEnvelope<SpeakingSelfRatingSubmitted> {
  eventName: "speaking.self_rating.submitted.v1";
  version: 1;
}

export interface OfflineSyncAppliedEvent extends PlatformEventEnvelope<OfflineSyncApplied> {
  eventName: "offline.sync.applied.v1";
  version: 1;
}

export interface GrammarMasteryUpdatedEvent extends PlatformEventEnvelope<GrammarMasteryUpdated> {
  eventName: "grammar.mastery.updated.v1";
  version: 1;
}

export interface ListeningProgressSavedEvent extends PlatformEventEnvelope<ListeningProgressSaved> {
  eventName: "listening.progress.saved.v1";
  version: 1;
}

export interface SpeakingShadowingProgressedEvent extends PlatformEventEnvelope<ShadowingProgressed> {
  eventName: "speaking.shadowing.progressed.v1";
  version: 1;
}

export interface MediaOfflinePackageSyncedEvent extends PlatformEventEnvelope<OfflinePackageSynced> {
  eventName: "media.offline.package.synced.v1";
  version: 1;
}

export interface GamificationProfileUpdatedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.profile.updated.v1";
  version: 1;
}

export interface GamificationXpLedgerAppendedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.xp.ledger_appended.v1";
  version: 1;
}

export interface GamificationCurrencyLedgerAppendedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.currency.ledger_appended.v1";
  version: 1;
}

export interface GamificationStreakDayValidatedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.streak.day_validated.v1";
  version: 1;
}

export interface GamificationStreakRescueCompletedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.streak.rescue_completed.v1";
  version: 1;
}

export interface GamificationQuestProgressedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.quest.progressed.v1";
  version: 1;
}

export interface GamificationQuestClaimedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.quest.claimed.v1";
  version: 1;
}

export interface GamificationAchievementUnlockedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.achievement.unlocked.v1";
  version: 1;
}

export interface GamificationChestGrantedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.chest.granted.v1";
  version: 1;
}

export interface GamificationChestOpenedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.chest.opened.v1";
  version: 1;
}

export interface GamificationAvatarLoadoutEquippedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.avatar.loadout_equipped.v1";
  version: 1;
}

export interface GamificationSeasonPointsUpdatedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "gamification.season.points_updated.v1";
  version: 1;
}

export interface GamesSessionCreatedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "games.session.created.v1";
  version: 1;
}

export interface GamesSessionEventAcceptedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "games.session.event_accepted.v1";
  version: 1;
}

export interface GamesSessionCompletedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "games.session.completed.v1";
  version: 1;
}

export interface SocialRoomJoinedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "social.room.joined.v1";
  version: 1;
}

export interface SocialFocusStartedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "social.focus.started.v1";
  version: 1;
}

export interface SocialFocusCompletedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "social.focus.completed.v1";
  version: 1;
}

export interface SocialInteractionSentEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "social.interaction.sent.v1";
  version: 1;
}

export interface OfflinePackageAuthorizedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "offline.package.authorized.v1";
  version: 1;
}

export interface OfflineB4SyncAppliedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "offline.b4.sync_applied.v1";
  version: 1;
}

export interface SocialRoomLeftEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "social.room.left.v1";
  version: 1;
}

export interface SocialFocusUpdatedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "social.focus.updated.v1";
  version: 1;
}

export interface SocialModerationReportedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "social.moderation.reported.v1";
  version: 1;
}

export interface SocialModerationBlockedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "social.moderation.blocked.v1";
  version: 1;
}

export interface SocialModerationMutedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "social.moderation.muted.v1";
  version: 1;
}

export interface NotificationsMessageReadEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "notifications.message_read.v1";
  version: 1;
}

export interface NotificationsPreferencesUpdatedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "notifications.preferences_updated.v1";
  version: 1;
}

export interface OfflinePackageDownloadStateUpdatedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "offline.package.download_state_updated.v1";
  version: 1;
}

export interface OfflineSyncConflictRecordedEvent extends PlatformEventEnvelope<B4FactPayload> {
  eventName: "offline.sync.conflict_recorded.v1";
  version: 1;
}

export interface CommerceOrderCreatedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "commerce.order.created.v1";
  version: 1;
}

export interface CommercePaymentRequestedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "commerce.payment.requested.v1";
  version: 1;
}

export interface CommercePaymentCallbackReceivedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "commerce.payment.callback_received.v1";
  version: 1;
}

export interface CommercePaymentVerifiedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "commerce.payment.verified.v1";
  version: 1;
}

export interface CommerceRefundCompletedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "commerce.refund.completed.v1";
  version: 1;
}

export interface CommerceHouseholdChangedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "commerce.household.changed.v1";
  version: 1;
}

export interface CmsContentVersionSavedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "cms.content.version_saved.v1";
  version: 1;
}

export interface CmsImportCompletedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "cms.import.completed.v1";
  version: 1;
}

export interface SafetyPrecheckBlockedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "safety.precheck.blocked.v1";
  version: 1;
}

export interface RiskDecisionCreatedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "risk.decision.created.v1";
  version: 1;
}

export interface FinanceReconciliationDiscrepancyEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "finance.reconciliation.discrepancy.v1";
  version: 1;
}

export interface OpsFlagUpdatedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "ops.flag.updated.v1";
  version: 1;
}

export interface SupportTicketCreatedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "support.ticket.created.v1";
  version: 1;
}

export interface SupportTicketResolvedEvent extends PlatformEventEnvelope<B5FactPayload> {
  eventName: "support.ticket.resolved.v1";
  version: 1;
}

export interface PlatformBuildRegisteredEvent extends PlatformEventEnvelope<B6FactPayload> {
  eventName: "platform.build.registered.v1";
  version: 1;
}

export interface PlatformCompatibilityCheckedEvent extends PlatformEventEnvelope<B6FactPayload> {
  eventName: "platform.compatibility.checked.v1";
  version: 1;
}

export interface PlatformPerformanceDegradedEvent extends PlatformEventEnvelope<B6FactPayload> {
  eventName: "platform.performance.degraded.v1";
  version: 1;
}

export interface QualityE2eCompletedEvent extends PlatformEventEnvelope<B6FactPayload> {
  eventName: "quality.e2e.completed.v1";
  version: 1;
}

export interface QualitySecurityScanCompletedEvent extends PlatformEventEnvelope<B6FactPayload> {
  eventName: "quality.security.scan_completed.v1";
  version: 1;
}

export interface QualityReliabilityCompletedEvent extends PlatformEventEnvelope<B6FactPayload> {
  eventName: "quality.reliability.completed.v1";
  version: 1;
}

export interface ObservabilityAlertRaisedEvent extends PlatformEventEnvelope<B6FactPayload> {
  eventName: "observability.alert.raised.v1";
  version: 1;
}

export interface DataBackupDrillCompletedEvent extends PlatformEventEnvelope<B6FactPayload> {
  eventName: "data.backup.drill_completed.v1";
  version: 1;
}

export interface ReleaseGateEvaluatedEvent extends PlatformEventEnvelope<B6FactPayload> {
  eventName: "release.gate.evaluated.v1";
  version: 1;
}

export interface AuthPrincipalMappedEvent extends PlatformEventEnvelope<AuthPrincipalMapped> {
  eventName: "auth.principal.mapped.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AuthSessionRotatedEvent extends PlatformEventEnvelope<AuthSessionRotated> {
  eventName: "auth.session.rotated.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AuthSessionReplayDetectedEvent extends PlatformEventEnvelope<AuthSessionReplayDetected> {
  eventName: "auth.session.replay_detected.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AuthDeviceRevokedEvent extends PlatformEventEnvelope<AuthDeviceRevoked> {
  eventName: "auth.device.revoked.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AuthConsentUpdatedEvent extends PlatformEventEnvelope<AuthConsentUpdated> {
  eventName: "auth.consent.updated.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AuthAdultGateRejectedEvent extends PlatformEventEnvelope<AuthAdultGateRejected> {
  eventName: "auth.adult_gate.rejected.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface IamPolicyVersionChangedEvent extends PlatformEventEnvelope<IamPolicyVersionChanged> {
  eventName: "iam.policy.version_changed.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface LearnerProfileUpdatedEvent extends PlatformEventEnvelope<B9LearnerProfileUpdated> {
  eventName: "learner.profile.updated.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface LearnerTargetUpdatedEvent extends PlatformEventEnvelope<B9LearnerTargetUpdated> {
  eventName: "learner.target.updated.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface LearnerFirstDayProjectedEvent extends PlatformEventEnvelope<B9LearnerFirstDayProjected> {
  eventName: "learner.first_day.projected.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface ContentVersionSubmittedEvent extends PlatformEventEnvelope<B9ContentVersionSubmitted> {
  eventName: "content.version.submitted.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface ContentVersionReviewedEvent extends PlatformEventEnvelope<B9ContentVersionReviewed> {
  eventName: "content.version.reviewed.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface ContentVersionPublishedEvent extends PlatformEventEnvelope<B9ContentVersionPublished> {
  eventName: "content.version.published.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface ContentVersionUnpublishedEvent extends PlatformEventEnvelope<B9ContentVersionUnpublished> {
  eventName: "content.version.unpublished.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface ContentVersionRolledBackEvent extends PlatformEventEnvelope<B9ContentVersionRolledBack> {
  eventName: "content.version.rolled_back.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface ContentPublicProjectionInvalidatedEvent extends PlatformEventEnvelope<B9PublicProjectionInvalidated> {
  eventName: "content.public_projection.invalidated.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AssessmentAttemptSubmittedEvent extends PlatformEventEnvelope<B10AssessmentAttemptSubmitted> {
  eventName: "assessment.attempt.submitted.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AssessmentAttemptAssessedEvent extends PlatformEventEnvelope<B10AssessmentAttemptAssessed> {
  eventName: "assessment.attempt.assessed.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface LearningMasteryProjectedEvent extends PlatformEventEnvelope<B10LearningMasteryProjected> {
  eventName: "learning.mastery.projected.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface LearningReviewScheduledEvent extends PlatformEventEnvelope<B10LearningReviewScheduled> {
  eventName: "learning.review.scheduled.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowAssessmentLearningSagaStartedEvent extends PlatformEventEnvelope<B10SagaStarted> {
  eventName: "workflow.assessment_learning.saga_started.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowAssessmentLearningSagaCompensatedEvent extends PlatformEventEnvelope<B10SagaCompensated> {
  eventName: "workflow.assessment_learning.saga_compensated.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowEventReplayedEvent extends PlatformEventEnvelope<B10EventReplayed> {
  eventName: "workflow.event.replayed.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface MediaStartedEvent extends PlatformEventEnvelope<B11MediaStarted> {
  eventName: "media.started.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface MediaSegmentCompletedEvent extends PlatformEventEnvelope<B11MediaSegmentCompleted> {
  eventName: "media.segment_completed.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface MediaDownloadedEvent extends PlatformEventEnvelope<B11MediaDownloaded> {
  eventName: "media.downloaded.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface MediaRevokedEvent extends PlatformEventEnvelope<B11MediaRevoked> {
  eventName: "media.revoked.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface SyncEnqueuedEvent extends PlatformEventEnvelope<B11SyncEnqueued> {
  eventName: "sync.enqueued.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface SyncConflictDetectedB11Event extends PlatformEventEnvelope<B11SyncConflictDetected> {
  eventName: "sync.conflict_detected.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface SyncRecoveredEvent extends PlatformEventEnvelope<B11SyncRecovered> {
  eventName: "sync.recovered.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface RecordingSavedEvent extends PlatformEventEnvelope<B11RecordingSaved> {
  eventName: "recording.saved.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface SpeakingPermissionRequestedEvent extends PlatformEventEnvelope<B11SpeakingPermissionRequested> {
  eventName: "speaking.permission_requested.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface ShadowingCompletedEvent extends PlatformEventEnvelope<B11ShadowingCompleted> {
  eventName: "shadowing.completed.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface GamificationSessionStartedEvent extends PlatformEventEnvelope<B12GrowthSessionStarted> {
  eventName: "gamification.session_started.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface GamificationXpLedgerPostedEvent extends PlatformEventEnvelope<B12GrowthLedgerPosted> {
  eventName: "gamification.xp.ledger_posted.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface GamificationRewardGrantedEvent extends PlatformEventEnvelope<B12RewardGranted> {
  eventName: "gamification.reward.granted.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface GamificationAvatarEquippedEvent extends PlatformEventEnvelope<B12AvatarEquipped> {
  eventName: "gamification.avatar.equipped.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface StudyRoomJoinedEvent extends PlatformEventEnvelope<B12StudyRoomJoined> {
  eventName: "study_room.joined.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface StudyRoomFocusStartedEvent extends PlatformEventEnvelope<B12FocusStarted> {
  eventName: "study_room.focus_started.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface StudyRoomLeftEvent extends PlatformEventEnvelope<B12StudyRoomLeft> {
  eventName: "study_room.left.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface LeaderboardRefreshedEvent extends PlatformEventEnvelope<B12LeaderboardRefreshed> {
  eventName: "leaderboard.refreshed.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface SocialReportCreatedEvent extends PlatformEventEnvelope<B12SocialReportCreated> {
  eventName: "social.report.created.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface NotificationRequestedEvent extends PlatformEventEnvelope<B12NotificationRequested> {
  eventName: "notification.requested.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface NotificationRetryScheduledEvent extends PlatformEventEnvelope<B12NotificationRetryScheduled> {
  eventName: "notification.retry_scheduled.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface NotificationRecoveryCompletedEvent extends PlatformEventEnvelope<B12NotificationRecoveryCompleted> {
  eventName: "notification.recovery.completed.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface CommerceOrderReconciledEvent extends PlatformEventEnvelope<B13CommerceOrderReconciled> {
  eventName: "commerce.order.reconciled.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AnalyticsMetricProjectedEvent extends PlatformEventEnvelope<B13AnalyticsMetricProjected> {
  eventName: "analytics.metric.projected.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AnalyticsRecomputeRequestedEvent extends PlatformEventEnvelope<B13AnalyticsRecomputeRequested> {
  eventName: "analytics.recompute.requested.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface IamSessionRevokedEvent extends PlatformEventEnvelope<IamSessionRevoked> {
  eventName: "iam.session.revoked.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowOutboxPublishedEvent extends PlatformEventEnvelope<B26WorkflowOutboxPublished> {
  eventName: "workflow.outbox.published.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowEventDeliveryFailedEvent extends PlatformEventEnvelope<B26WorkflowDeliveryFailed> {
  eventName: "workflow.event.delivery_failed.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowEventDeadLetteredEvent extends PlatformEventEnvelope<B26WorkflowDeadLettered> {
  eventName: "workflow.event.dead_lettered.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowEventReplayRequestedEvent extends PlatformEventEnvelope<B26WorkflowReplayRequested> {
  eventName: "workflow.event.replay_requested.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowEventOrderingDeferredEvent extends PlatformEventEnvelope<B26WorkflowOrderingDeferred> {
  eventName: "workflow.event.ordering_deferred.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowSagaCompensationRequestedEvent extends PlatformEventEnvelope<B26WorkflowCompensationRequested> {
  eventName: "workflow.saga.compensation_requested.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface WorkflowSagaManualRecoveryRequestedEvent extends PlatformEventEnvelope<B26WorkflowManualRecoveryRequested> {
  eventName: "workflow.saga.manual_recovery_requested.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AuthAccountRegisteredEvent extends PlatformEventEnvelope<AuthAccountRegistered> {
  eventName: "auth.account.registered.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export interface AuthLoginSucceededEvent extends PlatformEventEnvelope<AuthLoginSucceeded> {
  eventName: "auth.login.succeeded.v1";
  version: 1;
  schemaVersion: string;
  dedupeKey: string;
}

export type PlatformEvent = LearningSrsBatchCreatedEvent | VocabularyReviewAcceptedEvent | VocabularySrsStateChangedEvent | AssessmentAnswerScoredEvent | MasteryStateChangedEvent | LearningTaskCompletedEvent | CmsContentSubmittedEvent | CmsReviewDecidedEvent | CmsContentPublishedEvent | CmsContentRolledBackEvent | CommerceOrderPaidEvent | CommerceEntitlementActivatedEvent | CommerceEntitlementRevokedEvent | CommerceSubscriptionChangedEvent | NotificationCreatedEvent | NotificationDeliveredEvent | NotificationReadEvent | SyncLearningCheckpointSavedEvent | SyncConflictDetectedEvent | SyncCursorAdvancedEvent | AuthSessionRevokedEvent | AssessmentItemSubmittedEvent | AuthDeviceKickedEvent | PrivacyExportRequestedEvent | PrivacyExportCompletedEvent | AssessmentStreamBuiltEvent | AssessmentAnswerSubmittedEvent | MasteryVerificationStateChangedEvent | ExamSessionStateChangedEvent | ExamAntiCheatRecordedEvent | ReportGeneratedEvent | VocabularyReviewFilteredEvent | VocabularyExpressionCreatedEvent | GrammarPracticeCompletedEvent | WritingEvaluationCompletedEvent | ListeningDictationSubmittedEvent | ReadingProgressUpdatedEvent | SpeakingSelfRatingSubmittedEvent | OfflineSyncAppliedEvent | GrammarMasteryUpdatedEvent | ListeningProgressSavedEvent | SpeakingShadowingProgressedEvent | MediaOfflinePackageSyncedEvent | GamificationProfileUpdatedEvent | GamificationXpLedgerAppendedEvent | GamificationCurrencyLedgerAppendedEvent | GamificationStreakDayValidatedEvent | GamificationStreakRescueCompletedEvent | GamificationQuestProgressedEvent | GamificationQuestClaimedEvent | GamificationAchievementUnlockedEvent | GamificationChestGrantedEvent | GamificationChestOpenedEvent | GamificationAvatarLoadoutEquippedEvent | GamificationSeasonPointsUpdatedEvent | GamesSessionCreatedEvent | GamesSessionEventAcceptedEvent | GamesSessionCompletedEvent | SocialRoomJoinedEvent | SocialFocusStartedEvent | SocialFocusCompletedEvent | SocialInteractionSentEvent | OfflinePackageAuthorizedEvent | OfflineB4SyncAppliedEvent | SocialRoomLeftEvent | SocialFocusUpdatedEvent | SocialModerationReportedEvent | SocialModerationBlockedEvent | SocialModerationMutedEvent | NotificationsMessageReadEvent | NotificationsPreferencesUpdatedEvent | OfflinePackageDownloadStateUpdatedEvent | OfflineSyncConflictRecordedEvent | CommerceOrderCreatedEvent | CommercePaymentRequestedEvent | CommercePaymentCallbackReceivedEvent | CommercePaymentVerifiedEvent | CommerceRefundCompletedEvent | CommerceHouseholdChangedEvent | CmsContentVersionSavedEvent | CmsImportCompletedEvent | SafetyPrecheckBlockedEvent | RiskDecisionCreatedEvent | FinanceReconciliationDiscrepancyEvent | OpsFlagUpdatedEvent | SupportTicketCreatedEvent | SupportTicketResolvedEvent | PlatformBuildRegisteredEvent | PlatformCompatibilityCheckedEvent | PlatformPerformanceDegradedEvent | QualityE2eCompletedEvent | QualitySecurityScanCompletedEvent | QualityReliabilityCompletedEvent | ObservabilityAlertRaisedEvent | DataBackupDrillCompletedEvent | ReleaseGateEvaluatedEvent | AuthPrincipalMappedEvent | AuthSessionRotatedEvent | AuthSessionReplayDetectedEvent | AuthDeviceRevokedEvent | AuthConsentUpdatedEvent | AuthAdultGateRejectedEvent | IamPolicyVersionChangedEvent | LearnerProfileUpdatedEvent | LearnerTargetUpdatedEvent | LearnerFirstDayProjectedEvent | ContentVersionSubmittedEvent | ContentVersionReviewedEvent | ContentVersionPublishedEvent | ContentVersionUnpublishedEvent | ContentVersionRolledBackEvent | ContentPublicProjectionInvalidatedEvent | AssessmentAttemptSubmittedEvent | AssessmentAttemptAssessedEvent | LearningMasteryProjectedEvent | LearningReviewScheduledEvent | WorkflowAssessmentLearningSagaStartedEvent | WorkflowAssessmentLearningSagaCompensatedEvent | WorkflowEventReplayedEvent | MediaStartedEvent | MediaSegmentCompletedEvent | MediaDownloadedEvent | MediaRevokedEvent | SyncEnqueuedEvent | SyncConflictDetectedB11Event | SyncRecoveredEvent | RecordingSavedEvent | SpeakingPermissionRequestedEvent | ShadowingCompletedEvent | GamificationSessionStartedEvent | GamificationXpLedgerPostedEvent | GamificationRewardGrantedEvent | GamificationAvatarEquippedEvent | StudyRoomJoinedEvent | StudyRoomFocusStartedEvent | StudyRoomLeftEvent | LeaderboardRefreshedEvent | SocialReportCreatedEvent | NotificationRequestedEvent | NotificationRetryScheduledEvent | NotificationRecoveryCompletedEvent | CommerceOrderReconciledEvent | AnalyticsMetricProjectedEvent | AnalyticsRecomputeRequestedEvent | IamSessionRevokedEvent | WorkflowOutboxPublishedEvent | WorkflowEventDeliveryFailedEvent | WorkflowEventDeadLetteredEvent | WorkflowEventReplayRequestedEvent | WorkflowEventOrderingDeferredEvent | WorkflowSagaCompensationRequestedEvent | WorkflowSagaManualRecoveryRequestedEvent | AuthAccountRegisteredEvent | AuthLoginSucceededEvent;

export const canonicalEventGovernance = {
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
  }
} as const;

export type CanonicalEventName = keyof typeof canonicalEventGovernance;
export type CanonicalPlatformEvent = WorkflowOutboxPublishedEvent | WorkflowEventDeliveryFailedEvent | WorkflowEventDeadLetteredEvent | WorkflowEventReplayRequestedEvent | WorkflowEventOrderingDeferredEvent | WorkflowSagaCompensationRequestedEvent | WorkflowSagaManualRecoveryRequestedEvent;
