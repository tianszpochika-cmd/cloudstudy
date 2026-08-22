package com.englishflow.iam.domain;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Values that may arrive from an untrusted client request. They are represented explicitly so
 * every IAM write boundary can reject tenant, owner and role overrides instead of silently
 * accepting them.
 */
public record ClientAuthorityClaims(String tenantId, String ownerId, Set<String> roles) {

    public ClientAuthorityClaims {
        roles = roles == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(roles));
        if (roles.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("roles cannot contain null");
        }
    }

    public static ClientAuthorityClaims none() {
        return new ClientAuthorityClaims(null, null, Set.of());
    }

    public boolean hasOverride() {
        return nonBlank(tenantId) || nonBlank(ownerId) || !roles.isEmpty();
    }

    private static boolean nonBlank(String value) {
        return value != null && !value.isBlank();
    }
}
