package com.englishflow.learner.domain;

import java.time.Instant;
import java.util.Objects;

/** Original response snapshot retained for safe replay of a successful learner write. */
public record IdempotencyRecord(
        LearnerTenantScope scope,
        String operation,
        IdempotencyKey key,
        String fingerprint,
        LearnerProfile responseSnapshot,
        Instant recordedAt) {

    public IdempotencyRecord {
        Objects.requireNonNull(scope, "scope is required");
        if (operation == null || !operation.matches("[a-z][a-z0-9._:-]{0,63}")) {
            throw new IllegalArgumentException("operation has an invalid format");
        }
        Objects.requireNonNull(key, "key is required");
        if (fingerprint == null || fingerprint.isBlank()) {
            throw new IllegalArgumentException("fingerprint is required");
        }
        Objects.requireNonNull(responseSnapshot, "responseSnapshot is required");
        if (!scope.equals(responseSnapshot.scope())) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE,
                    "idempotency snapshot is outside the tenant/owner scope");
        }
        Objects.requireNonNull(recordedAt, "recordedAt is required");
    }

    public String namespacedKey() {
        return key.namespaced(scope, operation);
    }
}
