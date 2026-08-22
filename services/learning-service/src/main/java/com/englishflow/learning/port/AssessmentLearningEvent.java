package com.englishflow.learning.port;

import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.VerificationStage;

import java.time.Instant;
import java.util.Objects;

/** Minimal assessment-to-learning fact; answer text/rules are deliberately absent. */
public record AssessmentLearningEvent(
        String eventId,
        LearningTenantScope scope,
        LearningItemType itemType,
        long itemId,
        long contentVersionId,
        boolean correct,
        int score,
        String reason,
        String ruleVersion,
        VerificationStage verificationStage,
        Instant occurredAt) {

    public AssessmentLearningEvent {
        if (eventId == null || !eventId.matches("[A-Za-z0-9][A-Za-z0-9._:-]{15,127}")) {
            throw new IllegalArgumentException("eventId is invalid");
        }
        Objects.requireNonNull(scope, "scope is required");
        Objects.requireNonNull(itemType, "itemType is required");
        if (itemId < 1 || contentVersionId < 1 || score < 0 || score > 100) {
            throw new IllegalArgumentException("assessment evidence is invalid");
        }
        if (reason == null || !reason.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) {
            throw new IllegalArgumentException("reason is invalid");
        }
        if (ruleVersion == null || !ruleVersion.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,63}")) {
            throw new IllegalArgumentException("ruleVersion is invalid");
        }
        Objects.requireNonNull(verificationStage, "verificationStage is required");
        Objects.requireNonNull(occurredAt, "occurredAt is required");
    }
}
