package com.englishflow.learning.domain;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** Verified IAM facts; no request body value can construct or override this context. */
public record LearningPrincipalContext(
        LearningTenantScope scope,
        String phase,
        Set<String> roles,
        Set<String> permissions,
        ConsentState consent,
        boolean revoked,
        ClientAuthorityClaims clientAuthorityClaims) {

    public LearningPrincipalContext {
        Objects.requireNonNull(scope, "scope is required");
        if (phase == null || !phase.matches("phase-[1-3]")) {
            throw new IllegalArgumentException("phase must use phase-1, phase-2 or phase-3");
        }
        roles = immutableSet(roles);
        permissions = immutableSet(permissions);
        consent = consent == null ? ConsentState.UNKNOWN : consent;
        clientAuthorityClaims = clientAuthorityClaims == null
                ? ClientAuthorityClaims.none()
                : clientAuthorityClaims;
    }

    public static LearningPrincipalContext phaseOne(String principalId, long userId) {
        return new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne(principalId, userId),
                "phase-1",
                Set.of("learner"),
                Set.of(
                        "learning.plan.read",
                        "learning.plan.write",
                        "learning.review.read",
                        "learning.review.write",
                        "learning.progress.read",
                        "learning.progress.write",
                        "learning.mastery.read",
                        "learning.mastery.write",
                        "learning.task.write"),
                ConsentState.GRANTED,
                false,
                ClientAuthorityClaims.none());
    }

    public boolean hasRole(String role) {
        return role != null && roles.contains(role);
    }

    public boolean hasPermission(String permission) {
        return permission != null && permissions.contains(permission);
    }

    private static Set<String> immutableSet(Set<String> values) {
        return values == null || values.isEmpty()
                ? Set.of()
                : Set.copyOf(new LinkedHashSet<>(values));
    }
}
