package com.englishflow.learner.domain;

/**
 * Values that may arrive from a client but can never become authorization facts.
 * The HTTP/Gateway adapter should reject them before reaching the application port; the domain
 * keeps this type so direct port callers cannot accidentally bypass that rule.
 */
public record ClientAuthorityClaims(String role, String tenantId, String ownerId) {

    public ClientAuthorityClaims {
        role = normalize(role);
        tenantId = normalize(tenantId);
        ownerId = normalize(ownerId);
    }

    public static ClientAuthorityClaims none() {
        return new ClientAuthorityClaims(null, null, null);
    }

    public boolean containsAuthorityAttempt() {
        return role != null || tenantId != null || ownerId != null;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
