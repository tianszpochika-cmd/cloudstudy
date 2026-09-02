package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Current policy material emitted to a trusted local PEP, with a short security-cache lifetime. */
public record PolicyBundle(UUID bundleId, PolicyVersionRecord policy, Instant issuedAt, Instant expiresAt,
                           int cacheMaxAgeSeconds) {
    public PolicyBundle {
        Objects.requireNonNull(bundleId, "bundleId");
        Objects.requireNonNull(policy, "policy");
        Objects.requireNonNull(issuedAt, "issuedAt");
        Objects.requireNonNull(expiresAt, "expiresAt");
        if (policy.status() != PolicyLifecycleStatus.ACTIVE || !expiresAt.isAfter(issuedAt)
                || cacheMaxAgeSeconds < 1 || cacheMaxAgeSeconds > 300) {
            throw new IllegalArgumentException("policy bundle is invalid");
        }
    }
}
