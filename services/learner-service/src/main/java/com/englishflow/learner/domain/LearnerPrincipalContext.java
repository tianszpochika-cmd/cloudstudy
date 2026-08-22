package com.englishflow.learner.domain;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Verified principal facts received from the IAM/PEP adapter.
 * No constructor accepts a request body; the adapter is responsible for building this from a
 * validated token and IAM policy facts.
 */
public record LearnerPrincipalContext(
        LearnerTenantScope scope,
        String phase,
        Set<String> roles,
        Set<String> permissions,
        ConsentState consent,
        boolean revoked,
        ClientAuthorityClaims clientAuthorityClaims) {

    public LearnerPrincipalContext {
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

    public static LearnerPrincipalContext phaseOne(String subjectId) {
        return new LearnerPrincipalContext(
                LearnerTenantScope.forPhaseOne(subjectId),
                "phase-1",
                Set.of("learner"),
                Set.of(
                        "learner.profile.read",
                        "learner.profile.write",
                        "learner.goal.write",
                        "learner.preference.write",
                        "learner.onboarding.read"),
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
