package com.englishflow.notification.domain;

import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Immutable exact-name allowlist for notification-producing integration events. */
public final class TrustedEventAllowlist {

    private final Map<String, TrustedEventRule> rules;

    public TrustedEventAllowlist(Collection<TrustedEventRule> rules) {
        if (rules == null || rules.isEmpty()) {
            throw NotificationDomainException.invalid("trusted event allowlist cannot be empty");
        }
        LinkedHashMap<String, TrustedEventRule> copy = new LinkedHashMap<>();
        rules.forEach(rule -> {
            if (copy.put(rule.eventName(), rule) != null) {
                throw NotificationDomainException.invalid("trusted event allowlist contains a duplicate");
            }
        });
        this.rules = Map.copyOf(copy);
    }

    public Optional<TrustedEventRule> find(String eventName) {
        return Optional.ofNullable(rules.get(eventName));
    }

    public Map<String, TrustedEventRule> rules() {
        return rules;
    }

    public static TrustedEventAllowlist standard() {
        return new TrustedEventAllowlist(java.util.List.of(
                rule("assessment.attempt.assessed.v1", "assessment.event.v1", "assessment_attempt",
                        "assessment.result.ready", "assessment.result.ready", Set.of("attemptId", "sessionId",
                                "scoreBucket", "masterySignal", "assessmentVersion"), Duration.ZERO),
                rule("learning.mastery.projected.v1", "learning.event.v1", "learning_mastery_projection",
                        "learning.mastery.updated", "learning.mastery.updated", Set.of("projectionId", "itemId",
                                "toState", "projectionVersion"), Duration.ZERO),
                rule("learning.review.scheduled.v1", "learning.event.v1", "learning_review_queue",
                        "learning.review.due", "learning.review.due", Set.of("queueItemId", "itemId", "source",
                                "state", "dueAt", "queueVersion"), Duration.ZERO),
                rule("workflow.assessment_learning.saga_compensated.v1", "workflow.event.v1",
                        "assessment_learning_saga", "learning.recovery.required", "learning.recovery.required",
                        Set.of("sagaId", "failedStep", "compensationAction", "recoveryMode"), Duration.ZERO),
                rule("sync.conflict_detected.v1", "sync.event.v1", "sync_conflict", "sync.conflict.detected",
                        "sync.conflict.detected", Set.of("conflictId", "entityType", "entityId", "reasonCode",
                                "serverVersion"), Duration.ZERO),
                rule("sync.recovered.v1", "sync.event.v1", "sync_conflict", "sync.recovered", "sync.recovered",
                        Set.of("conflictId", "recoveryVersion", "resolution", "nextAction"), Duration.ZERO)));
    }

    private static TrustedEventRule rule(String eventName, String schema, String aggregateType,
            String notificationType, String templateId, Set<String> keys, Duration delay) {
        return new TrustedEventRule(eventName, schema, 1, aggregateType, notificationType, templateId, "v1",
                NotificationChannel.IN_APP, "zh-CN", keys, delay, true);
    }
}
