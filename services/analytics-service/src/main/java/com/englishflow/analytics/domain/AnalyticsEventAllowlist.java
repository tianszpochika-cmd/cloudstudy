package com.englishflow.analytics.domain;

import java.util.Map;
import java.util.Set;

/**
 * B10/B12 event allowlist. Do not turn this into a wildcard registry: a new event requires a new
 * explicit definition, metric version and privacy review.
 */
public final class AnalyticsEventAllowlist {

    private static final Map<String, AnalyticsEventDefinition> DEFINITIONS = Map.ofEntries(
            definition("assessment.attempt.submitted.v1", "assessment.event.v1", "assessment_attempt", "attemptId",
                    "assessment-service", "learning.attempt.submitted", "learning.v1",
                    Set.of("tenantId", "principalId", "attemptId", "sessionId", "contentVersionId", "contentSnapshotId",
                            "contentEpoch", "attemptVersion", "submissionDigest", "itemCount", "gradingRuleVersion", "submittedAt"),
                    Set.of(), null, null, Map.of()),
            definition("assessment.attempt.assessed.v1", "assessment.event.v1", "assessment_attempt", "attemptId",
                    "assessment-service", "learning.attempt.assessed", "learning.v1",
                    Set.of("tenantId", "principalId", "attemptId", "sessionId", "contentVersionId", "contentSnapshotId",
                            "attemptVersion", "assessmentVersion", "scoreBucket", "masterySignal", "mistakeCodes", "assessedAt"),
                    Set.of(), "scoreBucket", null, Map.of(
                            "scoreBucket", Set.of("ZERO", "PARTIAL", "FULL", "PENDING_REVIEW"),
                            "masterySignal", Set.of("NO_SIGNAL", "WEAK", "STABLE", "MASTERED", "RETRY"))),
            definition("learning.mastery.projected.v1", "learning.event.v1", "learning_mastery_projection", "projectionId",
                    "learning-service", "learning.mastery.projected", "learning.v1",
                    Set.of("tenantId", "principalId", "projectionId", "itemId", "sourceAttemptId", "sourceAssessmentEventId",
                            "contentVersionId", "contentEpoch", "fromState", "toState", "projectionVersion", "projectionStatus", "projectedAt"),
                    Set.of("srsStage", "nextReviewAt"), "projectionStatus", null, Map.of(
                            "fromState", Set.of("NONE", "LEARNING", "DELAY_VERIFY_D1", "DELAY_VERIFY_D7", "MASTERED", "REVIEW_QUEUE", "REOPENED"),
                            "toState", Set.of("LEARNING", "DELAY_VERIFY_D1", "DELAY_VERIFY_D7", "MASTERED", "REVIEW_QUEUE", "REOPENED"),
                            "srsStage", Set.of("NEW", "D0", "D1", "D7", "MASTERED"),
                            "projectionStatus", Set.of("APPLIED", "RETRYING", "COMPENSATED", "MANUAL_REVIEW")),
                    Set.of("nextReviewAt")),
            definition("learning.review.scheduled.v1", "learning.event.v1", "learning_review_queue", "queueItemId",
                    "learning-service", "learning.review.scheduled", "learning.v1",
                    Set.of("tenantId", "principalId", "queueItemId", "itemId", "sourceProjectionId", "queueVersion", "source", "state", "dueAt", "scheduledAt"),
                    Set.of(), "state", null, Map.of(
                            "source", Set.of("NEW", "REVIEW", "MISTAKE", "RETRY"),
                            "state", Set.of("LEARNING", "DELAY_VERIFY_D1", "DELAY_VERIFY_D7", "MASTERED", "REVIEW_QUEUE", "REOPENED"))),
            definition("workflow.assessment_learning.saga_started.v1", "workflow.event.v1", "assessment_learning_saga", "sagaId",
                    "workflow-service", "workflow.saga.started", "workflow.v1",
                    Set.of("tenantId", "sagaId", "sagaType", "rootEventId", "rootAggregateId", "currentStep", "sagaVersion", "startedAt"),
                    Set.of(), "currentStep", null, Map.of(
                            "sagaType", Set.of("ASSESSMENT_TO_LEARNING"),
                            "currentStep", Set.of("ASSESSMENT_ACCEPT", "ASSESSMENT_ASSESS", "LEARNING_PROJECT", "REVIEW_SCHEDULE"))),
            definition("workflow.assessment_learning.saga_compensated.v1", "workflow.event.v1", "assessment_learning_saga", "sagaId",
                    "workflow-service", "workflow.saga.compensated", "workflow.v1",
                    Set.of("tenantId", "sagaId", "sagaType", "failedEventId", "failedStep", "compensationKey", "compensationAction", "recoveryMode", "compensatedAt"),
                    Set.of(), "recoveryMode", null, Map.of(
                            "sagaType", Set.of("ASSESSMENT_TO_LEARNING"),
                            "failedStep", Set.of("ASSESSMENT_ACCEPT", "ASSESSMENT_ASSESS", "LEARNING_PROJECT", "REVIEW_SCHEDULE"),
                            "compensationAction", Set.of("MARK_PROJECTION_RETRY", "REVERT_PENDING_PROJECTION", "REOPEN_REVIEW_QUEUE", "CREATE_MANUAL_RECOVERY"),
                            "recoveryMode", Set.of("AUTOMATIC", "MANUAL_REVIEW"))),
            definition("workflow.event.replayed.v1", "workflow.event.v1", "event_replay", "replayId",
                    "workflow-service", "workflow.event.replayed", "workflow.v1",
                    Set.of("tenantId", "replayId", "sourceDlqId", "sourceEventId", "sourceEventName", "consumerName", "replayAttempt", "replayResult", "replayedAt"),
                    Set.of(), "replayResult", null, Map.of(
                            "replayResult", Set.of("APPLIED", "DUPLICATE_IGNORED", "REQUEUED", "QUARANTINED"))),
            definition("gamification.session_started.v1", "gamification.event.v1", "growth_session", "sessionId",
                    "gamification-service", "growth.session.started", "growth.v1",
                    Set.of("sessionId", "subjectRef", "ruleVersion", "startedAt"), Set.of(), null, null, Map.of()),
            definition("gamification.xp.ledger_posted.v1", "gamification.event.v1", "growth_ledger", "ledgerEntryId",
                    "gamification-service", "growth.ledger.posted", "growth.v1",
                    Set.of("ledgerEntryId", "subjectRef", "ledgerKind", "amount", "ruleVersion", "sourceEventId"), Set.of(), "ledgerKind", "amount", Map.of(
                            "ledgerKind", Set.of("SCORE", "CURRENCY"))),
            definition("gamification.reward.granted.v1", "gamification.event.v1", "reward_grant", "grantId",
                    "gamification-service", "growth.reward.granted", "growth.v1",
                    Set.of("grantId", "subjectRef", "rewardCode", "probabilityVersion", "grantState"), Set.of(), "grantState", null, Map.of(
                            "grantState", Set.of("AVAILABLE", "CLAIMED", "REVOKED"))),
            definition("gamification.avatar.equipped.v1", "gamification.event.v1", "avatar_loadout", "loadoutId",
                    "gamification-service", "growth.avatar.equipped", "growth.v1",
                    Set.of("loadoutId", "subjectRef", "assetVersion", "itemRefs"), Set.of(), null, null, Map.of()),
            definition("study_room.joined.v1", "social.event.v1", "study_room", "roomId",
                    "social-service", "social.room.joined", "social.v1",
                    Set.of("roomId", "seatId", "subjectRef", "leaseVersion", "visibility"), Set.of(), "visibility", null, Map.of(
                            "visibility", Set.of("PRIVATE", "ROOM_ONLY", "PUBLIC"))),
            definition("study_room.focus_started.v1", "social.event.v1", "focus_session", "focusId",
                    "social-service", "social.focus.started", "social.v1",
                    Set.of("focusId", "roomId", "subjectRef", "durationMinutes", "presetCode"), Set.of(), "presetCode", "durationMinutes", Map.of(
                            "presetCode", Set.of("FOCUS", "BREAK", "REVIEW"))),
            definition("study_room.left.v1", "social.event.v1", "study_room", "roomId",
                    "social-service", "social.room.left", "social.v1",
                    Set.of("roomId", "seatId", "subjectRef", "leaseVersion", "reasonCode"), Set.of(), "reasonCode", null, Map.of(
                            "reasonCode", Set.of("USER_LEFT", "LEASE_EXPIRED", "DISCONNECT_CLEANUP"))),
            definition("leaderboard.refreshed.v1", "social.event.v1", "leaderboard_projection", "projectionId",
                    "social-service", "social.leaderboard.refreshed", "social.v1",
                    Set.of("projectionId", "kind", "period", "projectionVersion", "entryCount"), Set.of(), "kind", null, Map.of()),
            definition("social.report.created.v1", "social.event.v1", "social_report", "reportId",
                    "social-service", "social.report.created", "social.v1",
                    Set.of("reportId", "roomId", "targetRef", "categoryCode", "state"), Set.of(), "categoryCode", null, Map.of(
                            "categoryCode", Set.of("HARASSMENT", "SPAM", "INAPPROPRIATE_BEHAVIOR", "SAFETY"),
                            "state", Set.of("OPEN", "REVIEWING", "RESOLVED", "DISMISSED"))),
            definition("notification.requested.v1", "notification.event.v1", "notification", "notificationId",
                    "notification-service", "notification.requested", "notification.v1",
                    Set.of("notificationId", "subjectRef", "templateId", "templateVersion", "channel", "locale"), Set.of(), "channel", null, Map.of(
                            "channel", Set.of("IN_APP", "PUSH", "EMAIL"))),
            definition("notification.retry_scheduled.v1", "notification.event.v1", "notification_delivery", "taskId",
                    "notification-service", "notification.retry.scheduled", "notification.v1",
                    Set.of("taskId", "notificationId", "attemptCount", "nextAttemptAt", "failureCode"), Set.of(), "failureCode", "attemptCount", Map.of()),
            definition("notification.recovery.completed.v1", "notification.event.v1", "notification_recovery", "taskId",
                    "notification-service", "notification.recovery.completed", "notification.v1",
                    Set.of("taskId", "state", "auditRef", "domainFactsUntouched"), Set.of(), "state", null, Map.of(
                            "state", Set.of("SUCCEEDED", "REJECTED", "MANUAL_REVIEW"),
                            "domainFactsUntouched", Set.of("true")))
    );

    private AnalyticsEventAllowlist() {
    }

    public static AnalyticsEventDefinition definition(String eventName) {
        return DEFINITIONS.get(eventName);
    }

    public static Set<String> eventNames() {
        return DEFINITIONS.keySet();
    }

    private static Map.Entry<String, AnalyticsEventDefinition> definition(
            String eventName, String schema, String aggregateType, String aggregateIdField, String sourceService,
            String metricId, String metricVersion, Set<String> required, Set<String> optional, String dimensionField,
            String valueField, Map<String, Set<String>> enumFields) {
        return definition(eventName, schema, aggregateType, aggregateIdField, sourceService, metricId, metricVersion,
                required, optional, dimensionField, valueField, enumFields, Set.of());
    }

    private static Map.Entry<String, AnalyticsEventDefinition> definition(
            String eventName, String schema, String aggregateType, String aggregateIdField, String sourceService,
            String metricId, String metricVersion, Set<String> required, Set<String> optional, String dimensionField,
            String valueField, Map<String, Set<String>> enumFields, Set<String> nullablePayloadFields) {
        Set<String> allowed = new java.util.LinkedHashSet<>(required);
        allowed.addAll(optional);
        return Map.entry(eventName, new AnalyticsEventDefinition(eventName, schema, 1, aggregateType, aggregateIdField,
                sourceService, metricId, metricVersion, required, allowed, dimensionField, valueField, enumFields,
                nullablePayloadFields));
    }
}
