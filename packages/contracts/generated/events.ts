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

export interface CommerceEntitlementActivatedEvent extends PlatformEventEnvelope<CommerceEntitlementActivated> {
  eventName: "commerce.entitlement.activated.v1";
  version: 1;
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

export interface NotificationDeliveredEvent extends PlatformEventEnvelope<NotificationDelivered> {
  eventName: "notification.delivered.v1";
  version: 1;
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

export type PlatformEvent = LearningSrsBatchCreatedEvent | VocabularyReviewAcceptedEvent | VocabularySrsStateChangedEvent | AssessmentAnswerScoredEvent | MasteryStateChangedEvent | LearningTaskCompletedEvent | CmsContentSubmittedEvent | CmsReviewDecidedEvent | CmsContentPublishedEvent | CmsContentRolledBackEvent | CommerceOrderPaidEvent | CommerceEntitlementActivatedEvent | CommerceEntitlementRevokedEvent | CommerceSubscriptionChangedEvent | NotificationCreatedEvent | NotificationDeliveredEvent | NotificationReadEvent | SyncLearningCheckpointSavedEvent | SyncConflictDetectedEvent | SyncCursorAdvancedEvent | AuthSessionRevokedEvent | AssessmentItemSubmittedEvent | AuthDeviceKickedEvent | PrivacyExportRequestedEvent | PrivacyExportCompletedEvent | AssessmentStreamBuiltEvent | AssessmentAnswerSubmittedEvent | MasteryVerificationStateChangedEvent | ExamSessionStateChangedEvent | ExamAntiCheatRecordedEvent | ReportGeneratedEvent | VocabularyReviewFilteredEvent | VocabularyExpressionCreatedEvent | GrammarPracticeCompletedEvent | WritingEvaluationCompletedEvent | ListeningDictationSubmittedEvent | ReadingProgressUpdatedEvent | SpeakingSelfRatingSubmittedEvent | OfflineSyncAppliedEvent | GrammarMasteryUpdatedEvent | ListeningProgressSavedEvent | SpeakingShadowingProgressedEvent | MediaOfflinePackageSyncedEvent | GamificationProfileUpdatedEvent | GamificationXpLedgerAppendedEvent | GamificationCurrencyLedgerAppendedEvent | GamificationStreakDayValidatedEvent | GamificationStreakRescueCompletedEvent | GamificationQuestProgressedEvent | GamificationQuestClaimedEvent | GamificationAchievementUnlockedEvent | GamificationChestGrantedEvent | GamificationChestOpenedEvent | GamificationAvatarLoadoutEquippedEvent | GamificationSeasonPointsUpdatedEvent | GamesSessionCreatedEvent | GamesSessionEventAcceptedEvent | GamesSessionCompletedEvent | SocialRoomJoinedEvent | SocialFocusStartedEvent | SocialFocusCompletedEvent | SocialInteractionSentEvent | OfflinePackageAuthorizedEvent | OfflineB4SyncAppliedEvent;
