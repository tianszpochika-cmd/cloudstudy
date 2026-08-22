package com.englishflow.platform.template.security;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Small, immutable RBAC portion of a policy package. ABAC facts remain request/resource facts
 * and are always evaluated by {@link LocalPolicyEvaluator}.
 */
public record PolicySnapshot(
        PolicyVersion version,
        Map<String, Set<String>> roleActions,
        boolean signatureVerified
) {

    public PolicySnapshot(PolicyVersion version, Map<String, Set<String>> roleActions) {
        this(version, roleActions, false);
    }

    public PolicySnapshot {
        Objects.requireNonNull(version, "policy version is required");
        if (roleActions == null || roleActions.isEmpty()) {
            roleActions = Map.of();
        } else {
            Map<String, Set<String>> normalized = new LinkedHashMap<>();
            roleActions.forEach((role, actions) -> {
                if (role == null || role.isBlank()) {
                    throw new IllegalArgumentException("policy role is required");
                }
                Set<String> normalizedActions = actions == null || actions.isEmpty()
                        ? Set.of()
                        : Collections.unmodifiableSet(new LinkedHashSet<>(actions));
                normalized.put(role, normalizedActions);
            });
            roleActions = Collections.unmodifiableMap(normalized);
        }
    }

    /** Construct a snapshot only after a trusted policy loader verifies its signature. */
    public static PolicySnapshot trusted(PolicyVersion version, Map<String, Set<String>> roleActions) {
        return new PolicySnapshot(version, roleActions, true);
    }

    public boolean permits(VerifiedClaims claims, String action) {
        if (claims == null || action == null || action.isBlank()) {
            return false;
        }
        if (claims.permissions().contains(action)) {
            return true;
        }
        for (String role : claims.roles()) {
            if (roleActions.getOrDefault(role, Set.of()).contains(action)) {
                return true;
            }
        }
        return false;
    }
}
