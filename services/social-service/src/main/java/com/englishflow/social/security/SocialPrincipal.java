package com.englishflow.social.security;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Identity facts produced by a verified IAM token. HTTP bodies and headers never construct this
 * object. The phase-one factory is used only by pure smoke tests and the local domain harness.
 */
public record SocialPrincipal(
        String subjectId,
        String tenantId,
        String phase,
        boolean consentGranted,
        boolean active,
        boolean revoked,
        Set<String> permissions,
        Set<String> roles
) {

    public static final String PHASE_ONE = "phase-1";
    public static final String PLATFORM_TENANT = "platform";

    public SocialPrincipal {
        if (subjectId == null || subjectId.isBlank()) {
            throw new IllegalArgumentException("subjectId is required");
        }
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("tenantId is required");
        }
        permissions = immutable(permissions);
        roles = immutable(roles);
    }

    /** Trusted test/domain principal; no HTTP adapter uses client-provided identity. */
    public static SocialPrincipal phaseOne(String subjectId) {
        return phaseOne(subjectId, PLATFORM_TENANT, Set.of(
                "social.room.read",
                "social.room.join",
                "social.room.member.read",
                "social.room.write",
                "social.focus.write",
                "social.interaction.send",
                "social.leaderboard.read",
                "social.report.create",
                "social.report.read",
                "social.visibility.write"));
    }

    public static SocialPrincipal phaseOne(String subjectId, String tenantId, Set<String> permissions) {
        return new SocialPrincipal(subjectId, tenantId, PHASE_ONE, true, true, false, permissions, Set.of());
    }

    public static SocialPrincipal servicePrincipal(String serviceName, String tenantId, Set<String> permissions) {
        return new SocialPrincipal(serviceName, tenantId, PHASE_ONE, true, true, false, permissions, Set.of("SERVICE"));
    }

    public boolean hasPermission(String permission) {
        return permissions.contains(permission) || permissions.contains("*");
    }

    public boolean isUsablePhaseOne() {
        return active && !revoked && consentGranted && PHASE_ONE.equals(phase);
    }

    private static Set<String> immutable(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        return Collections.unmodifiableSet(new LinkedHashSet<>(values));
    }
}
