package com.englishflow.learning.domain;

/** Values submitted by a client are explicitly non-authoritative. */
public record ClientAuthorityClaims(String clientTenantId, String clientOwnerId, String clientRole) {

    public static ClientAuthorityClaims none() {
        return new ClientAuthorityClaims(null, null, null);
    }

    public boolean containsAuthorityAttempt() {
        return present(clientTenantId) || present(clientOwnerId) || present(clientRole);
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }
}
