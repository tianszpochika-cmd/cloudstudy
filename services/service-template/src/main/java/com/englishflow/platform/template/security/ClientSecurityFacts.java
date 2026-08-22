package com.englishflow.platform.template.security;

import java.util.Objects;

/**
 * Values supplied by a client that may look like security facts but are never authorities.
 *
 * <p>The HTTP boundary rejects these values. Keeping the same representation in the pure PEP
 * context makes it impossible for an adapter to accidentally bypass the boundary when it calls
 * the evaluator directly.</p>
 */
public record ClientSecurityFacts(
        String roleHeader,
        String b5RoleHeader,
        String tenantId,
        String ownerId
) {

    public ClientSecurityFacts {
        roleHeader = normalize(roleHeader);
        b5RoleHeader = normalize(b5RoleHeader);
        tenantId = normalize(tenantId);
        ownerId = normalize(ownerId);
    }

    public static ClientSecurityFacts none() {
        return new ClientSecurityFacts(null, null, null, null);
    }

    public boolean containsAuthorityAttempt() {
        return roleHeader != null
                || b5RoleHeader != null
                || tenantId != null
                || ownerId != null;
    }

    private static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Objects.requireNonNull(value, "client security fact");
    }
}
