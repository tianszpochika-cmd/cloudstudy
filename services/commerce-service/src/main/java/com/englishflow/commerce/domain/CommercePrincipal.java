package com.englishflow.commerce.domain;

import java.util.Set;

/** Facts derived from a verified OIDC token or a trusted provider boundary. */
public record CommercePrincipal(String tenantId, String subjectId, Set<String> permissions,
        boolean authenticated, boolean verified, boolean servicePrincipal) {
    public CommercePrincipal {
        if (tenantId == null || tenantId.isBlank() || subjectId == null || subjectId.isBlank()) throw CommerceException.unauthorized();
        permissions = permissions == null ? Set.of() : Set.copyOf(permissions);
    }
    public boolean has(String permission) { return permissions.contains(permission); }
    public static CommercePrincipal user(String tenantId, String subjectId, String... permissions) { return new CommercePrincipal(tenantId, subjectId, Set.of(permissions), true, true, false); }
    public static CommercePrincipal staff(String tenantId, String subjectId, String... permissions) { return new CommercePrincipal(tenantId, subjectId, Set.of(permissions), true, true, false); }
    public static CommercePrincipal system(String tenantId, String subjectId, String... permissions) { return new CommercePrincipal(tenantId, subjectId, Set.of(permissions), true, true, true); }
}
