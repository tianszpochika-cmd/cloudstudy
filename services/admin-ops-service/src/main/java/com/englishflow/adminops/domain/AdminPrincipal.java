package com.englishflow.adminops.domain;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Verified identity passed into the domain layer. No request body or client header can construct
 * a production principal; HTTP adapters create it only after token verification.
 */
public record AdminPrincipal(
        String subjectId,
        String tenantId,
        Set<String> permissions,
        Set<String> roles,
        String workloadId) {

    public AdminPrincipal {
        if (subjectId == null || subjectId.isBlank()) {
            throw AdminOpsException.unauthenticated();
        }
        if (tenantId == null || tenantId.isBlank()) {
            throw AdminOpsException.forbidden("ADMIN_TENANT_MISSING", "server-derived tenant scope is required");
        }
        permissions = normalize(permissions);
        roles = normalize(roles);
        if (workloadId != null && workloadId.isBlank()) {
            workloadId = null;
        }
    }

    public boolean hasPermission(String permission) {
        return permission != null && permissions.contains(permission);
    }

    public boolean hasRole(String role) {
        return role != null && roles.contains(role);
    }

    public boolean isWorkload() {
        return workloadId != null;
    }

    public static AdminPrincipal user(String subjectId, String tenantId, String... permissions) {
        return new AdminPrincipal(subjectId, tenantId, Set.of(permissions), Set.of(), null);
    }

    public static AdminPrincipal userWithRoles(
            String subjectId, String tenantId, Set<String> permissions, Set<String> roles) {
        return new AdminPrincipal(subjectId, tenantId, permissions, roles, null);
    }

    public static AdminPrincipal workload(String sourceService, String tenantId, String... permissions) {
        return new AdminPrincipal("workload:" + sourceService, tenantId, Set.of(permissions), Set.of(), sourceService);
    }

    private static Set<String> normalize(Set<String> values) {
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        if (values != null) {
            for (String value : values) {
                if (value != null && !value.isBlank()) {
                    normalized.add(value.trim());
                }
            }
        }
        return Set.copyOf(normalized);
    }
}
