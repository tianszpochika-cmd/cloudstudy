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

export type PlatformEvent = LearningSrsBatchCreatedEvent | VocabularyReviewAcceptedEvent | VocabularySrsStateChangedEvent | AssessmentAnswerScoredEvent | MasteryStateChangedEvent | LearningTaskCompletedEvent | CmsContentSubmittedEvent | CmsReviewDecidedEvent | CmsContentPublishedEvent | CmsContentRolledBackEvent | CommerceOrderPaidEvent | CommerceEntitlementActivatedEvent | CommerceEntitlementRevokedEvent | CommerceSubscriptionChangedEvent | NotificationCreatedEvent | NotificationDeliveredEvent | NotificationReadEvent | SyncLearningCheckpointSavedEvent | SyncConflictDetectedEvent | SyncCursorAdvancedEvent | AuthSessionRevokedEvent;
