package com.englishflow.learning.domain;

import java.time.Instant;
import java.util.Objects;

/** Assessment/SRS result seam. It contains scoring evidence, never answer text or answer rules. */
public record MasteryEvidence(
        String evidenceId,
        LearningTenantScope scope,
        LearningItemType itemType,
        long itemId,
        long contentVersionId,
        boolean correct,
        int evidenceScore,
        String reason,
        String ruleVersion,
        VerificationStage verificationStage,
        Instant observedAt) {

    public MasteryEvidence {
        requireSafe(evidenceId, "evidenceId");
        Objects.requireNonNull(scope, "scope is required");
        Objects.requireNonNull(itemType, "itemType is required");
        if (itemId < 1 || contentVersionId < 1 || evidenceScore < 0 || evidenceScore > 100) {
            throw new IllegalArgumentException("mastery evidence values are invalid");
        }
        requireSafe(reason, "reason");
        requireSafe(ruleVersion, "ruleVersion");
        Objects.requireNonNull(verificationStage, "verificationStage is required");
        Objects.requireNonNull(observedAt, "observedAt is required");
    }

    private static void requireSafe(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 128
                || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]*")) {
            throw new IllegalArgumentException(field + " has an unsafe format");
        }
    }
}
