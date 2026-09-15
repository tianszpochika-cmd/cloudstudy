package com.englishflow.learning.application;

import com.englishflow.learning.domain.LearningOutboxEvent;
import com.englishflow.learning.domain.LearningRequestMetadata;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.LearningTask;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.ReviewEvent;
import com.englishflow.learning.domain.SrsState;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Builds only registered Phase 1 learning event shapes; delivery remains an adapter concern. */
final class LearningEventFactory {

    private static final String SCHEMA = "learning.event.v1";

    private LearningEventFactory() {
    }

    static LearningOutboxEvent reviewAccepted(
            LearningTenantScope scope,
            ReviewEvent review,
            SrsState state,
            LearningRequestMetadata metadata,
            Instant occurredAt) {
        return event(scope, "review_event", Long.toString(review.reviewEventId()),
                "vocabulary.review.accepted.v1",
                "review-accepted-" + review.reviewEventId(),
                Map.of(
                        "reviewEventId", review.reviewEventId(),
                        "userId", scope.userId(),
                        "srsStateId", review.srsStateId(),
                        "stateVersion", review.stateVersion(),
                        "effectiveQuality", review.effectiveQuality(),
                        "riskDecision", "ALLOW",
                        "itemType", review.itemType().name()),
                metadata, occurredAt);
    }

    static LearningOutboxEvent srsStateChanged(
            LearningTenantScope scope,
            SrsState before,
            SrsState after,
            LearningRequestMetadata metadata,
            Instant occurredAt) {
        return event(scope, "srs_state", Long.toString(after.srsStateId()),
                "vocabulary.srs.state_changed.v1",
                "srs-state-" + after.srsStateId() + "-v" + after.stateVersion(),
                Map.of(
                        "srsStateId", after.srsStateId(),
                        "itemType", after.itemType().name(),
                        "targetId", after.targetId(),
                        "before", before.stage().name(),
                        "after", after.stage().name(),
                        "algorithmVersion", "SM2_Q03_V1"),
                metadata, occurredAt);
    }

    static LearningOutboxEvent masteryChanged(
            LearningTenantScope scope,
            MasteryProjection before,
            MasteryProjection after,
            String reason,
            LearningRequestMetadata metadata,
            Instant occurredAt) {
        return event(scope, "mastery_projection", Long.toString(after.itemId()),
                "mastery.state_changed.v1",
                "mastery-" + after.itemType().name() + "-" + after.itemId() + "-v" + after.version(),
                Map.of(
                        "userId", scope.userId(),
                        "itemType", after.itemType().name(),
                        "itemId", after.itemId(),
                        "from", before.stage().name(),
                        "to", after.stage().name(),
                        "reason", boundedReason(reason),
                        "verificationStage", after.verificationStage().name()),
                metadata, occurredAt);
    }

    static LearningOutboxEvent taskCompleted(
            LearningTenantScope scope,
            LearningTask task,
            LearningRequestMetadata metadata,
            Instant occurredAt) {
        return event(scope, "learning_task", Long.toString(task.taskId()),
                "learning.task.completed.v1",
                "task-completed-" + task.taskId() + "-v" + task.completionVersion(),
                Map.of(
                        "userId", scope.userId(),
                        "taskId", task.taskId(),
                        "taskType", task.taskType().name(),
                        "completedAt", occurredAt.toString(),
                        "completionVersion", task.completionVersion()),
                metadata, occurredAt);
    }

    /**
     * M5-013 trusted completion (v2, M1014): the gamification/ledger whitelist entry.
     * Only SERVER_SETTLED completions qualify; the payload carries pins and digests,
     * never raw answers, audio or free text. Dedupe key is stable per task version so
     * replays append once.
     */
    static final java.util.Set<String> TRUSTED_COMPLETION_SOURCES =
            java.util.Set.of("learning.task.completed.v2");

    static LearningOutboxEvent trustedTaskCompleted(
            LearningTenantScope scope,
            LearningTask task,
            long contentEpoch,
            String completionRuleVersion,
            LearningRequestMetadata metadata,
            Instant occurredAt) {
        String outcomeDigest = sha256Hex(task.taskId() + ":" + task.completionVersion() + ":"
                + task.contentVersionId() + ":" + completionRuleVersion);
        return v2event(scope, "learning_task_completion", Long.toString(task.taskId()),
                "learning.task.completed.v2",
                "trusted-task-completed-" + task.taskId() + "-v" + task.completionVersion(),
                Map.of(
                        "producerService", "learning-service",
                        "taskStatus", "COMPLETED",
                        "completionFact", "SERVER_SETTLED",
                        "taskId", task.taskId(),
                        "completionVersion", task.completionVersion(),
                        "contentVersionId", task.contentVersionId(),
                        "contentEpoch", contentEpoch,
                        "completionRuleVersion", completionRuleVersion,
                        "outcomeDigest", outcomeDigest,
                        "completedAt", occurredAt.toString()),
                metadata, occurredAt);
    }

    private static LearningOutboxEvent v2event(
            LearningTenantScope scope,
            String aggregateType,
            String aggregateId,
            String eventType,
            String dedupeKey,
            Map<String, Object> payload,
            LearningRequestMetadata metadata,
            Instant occurredAt) {
        return new LearningOutboxEvent(
                UUID.randomUUID(), scope, aggregateType, aggregateId, eventType, "v2", 2,
                scope.principalId(), dedupeKey, payload,
                metadata.requestId(), metadata.traceId(), occurredAt);
    }

    private static String sha256Hex(String value) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    static LearningOutboxEvent queueCreated(
            LearningTenantScope scope,
            long scheduleSnapshotId,
            java.time.LocalDate localDate,
            String rulesVersion,
            int itemCount,
            LearningRequestMetadata metadata,
            Instant occurredAt) {
        return event(scope, "srs_schedule", Long.toString(scheduleSnapshotId),
                "learning.srs.batch_created.v1",
                "srs-batch-" + scheduleSnapshotId,
                Map.of(
                        "userId", scope.userId(),
                        "scheduleSnapshotId", scheduleSnapshotId,
                        "localDate", localDate.toString(),
                        "rulesVersion", rulesVersion,
                        "itemCount", itemCount),
                metadata, occurredAt);
    }

    private static LearningOutboxEvent event(
            LearningTenantScope scope,
            String aggregateType,
            String aggregateId,
            String eventType,
            String dedupeKey,
            Map<String, Object> payload,
            LearningRequestMetadata metadata,
            Instant occurredAt) {
        return new LearningOutboxEvent(
                UUID.randomUUID(), scope, aggregateType, aggregateId, eventType, SCHEMA, 1,
                scope.principalId(), dedupeKey, payload,
                metadata.requestId(), metadata.traceId(), occurredAt);
    }

    private static String boundedReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return "RULE_EVALUATED";
        }
        return reason.length() > 64 ? reason.substring(0, 64) : reason;
    }
}
