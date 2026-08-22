package com.englishflow.learning.domain;

import java.time.Instant;
import java.util.Objects;

/** Immutable review fact; the idempotency key is kept as evidence, not as a mutable queue flag. */
public record ReviewEvent(
        long reviewEventId,
        LearningTenantScope scope,
        LearningItemType itemType,
        long targetId,
        long itemId,
        long contentVersionId,
        String algorithmVersion,
        long srsStateId,
        int stateVersion,
        int rawQuality,
        int effectiveQuality,
        ReviewConfidence confidence,
        Instant reviewedAt,
        String clientEventId) {

    public ReviewEvent {
        if (reviewEventId < 1 || targetId < 1 || itemId < 1 || contentVersionId < 1
                || srsStateId < 1 || stateVersion < 1) {
            throw new IllegalArgumentException("review identifiers and version must be positive");
        }
        if (algorithmVersion == null || !algorithmVersion.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,63}")) {
            throw new IllegalArgumentException("algorithmVersion has an unsafe format");
        }
        Objects.requireNonNull(scope, "scope is required");
        Objects.requireNonNull(itemType, "itemType is required");
        if (!itemType.srsEligible()) {
            throw new IllegalArgumentException("review item type is not SRS eligible");
        }
        if (rawQuality < 0 || rawQuality > 3 || effectiveQuality < 0 || effectiveQuality > 3) {
            throw new IllegalArgumentException("quality must be between 0 and 3");
        }
        Objects.requireNonNull(confidence, "confidence is required");
        Objects.requireNonNull(reviewedAt, "reviewedAt is required");
        requireSafe(clientEventId, "clientEventId");
    }

    private static void requireSafe(String value, String field) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{15,127}")) {
            throw new IllegalArgumentException(field + " must contain 16-128 safe characters");
        }
    }
}
