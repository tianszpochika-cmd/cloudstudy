package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A durable receipt that makes PEP cache invalidation observable without pretending that the
 * M2-005 event/outbox delivery work has already happened.
 */
public record PolicyCacheInvalidationReceipt(
        UUID invalidationId,
        boolean required,
        String status,
        String scope,
        Instant issuedAt,
        Instant completedAt,
        boolean denyUntilCurrentVersionProven) {

    public PolicyCacheInvalidationReceipt {
        Objects.requireNonNull(invalidationId, "invalidationId");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(issuedAt, "issuedAt");
        if (!denyUntilCurrentVersionProven) {
            throw new IllegalArgumentException("policy invalidation must fail closed");
        }
        if (!SetOf.STATUS.contains(status) || !SetOf.SCOPE.contains(scope)) {
            throw new IllegalArgumentException("policy invalidation receipt is invalid");
        }
    }

    public static PolicyCacheInvalidationReceipt notRequired(Instant at) {
        return new PolicyCacheInvalidationReceipt(UUID.randomUUID(), false, "NOT_REQUIRED", "NONE",
                at, at, true);
    }

    public static PolicyCacheInvalidationReceipt pendingActivation(Instant at) {
        return new PolicyCacheInvalidationReceipt(UUID.randomUUID(), true, "PENDING",
                "AFFECTED_PEP_SECURITY_CACHES", at, null, true);
    }

    public static PolicyCacheInvalidationReceipt pendingRevocation(Instant at) {
        return new PolicyCacheInvalidationReceipt(UUID.randomUUID(), true, "PENDING",
                "REVOCATION_AND_AFFECTED_PEP_SECURITY_CACHES", at, null, true);
    }

    private static final class SetOf {
        private static final java.util.Set<String> STATUS = java.util.Set.of(
                "NOT_REQUIRED", "PENDING", "COMPLETED", "FAILED");
        private static final java.util.Set<String> SCOPE = java.util.Set.of(
                "NONE", "POLICY_VERSION", "AFFECTED_PEP_SECURITY_CACHES",
                "REVOCATION_AND_AFFECTED_PEP_SECURITY_CACHES");
    }
}
