package com.englishflow.adminops.domain;

/** Default-deny service-side policy enforcement point. */
public final class AdminPep {

    public void requireAuthenticated(AdminPrincipal principal) {
        if (principal == null) {
            throw AdminOpsException.unauthenticated();
        }
    }

    public void requirePermission(AdminPrincipal principal, String permission) {
        requireAuthenticated(principal);
        if (permission == null || permission.isBlank() || !principal.hasPermission(permission)) {
            throw AdminOpsException.forbidden("ADMIN_PERMISSION_DENIED", "permission denied");
        }
    }

    public void requireTenant(AdminPrincipal principal, String resourceTenantId) {
        requireAuthenticated(principal);
        if (resourceTenantId == null || resourceTenantId.isBlank()) {
            throw AdminOpsException.forbidden("ADMIN_RESOURCE_TENANT_MISSING", "resource tenant is unavailable");
        }
        if (!principal.tenantId().equals(resourceTenantId)) {
            throw AdminOpsException.forbidden("ADMIN_TENANT_FORBIDDEN", "resource is outside the tenant scope");
        }
    }

    public void requireOperatorNotAuthor(AdminPrincipal principal, String authorSubjectId) {
        requireAuthenticated(principal);
        if (authorSubjectId != null && authorSubjectId.equals(principal.subjectId())) {
            throw AdminOpsException.forbidden(
                    "ADMIN_AUTHOR_OPERATOR_CONFLICT", "the author cannot approve, publish or operate their own resource");
        }
    }
}
