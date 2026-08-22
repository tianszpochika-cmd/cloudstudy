package com.englishflow.commerce.application.security;

import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.CommercePrincipal;

/** Default-deny PEP used by every application command. */
public final class CommerceAccessPolicy {
    public void requireAuthenticated(CommercePrincipal principal) {
        if (principal == null || !principal.authenticated() || !principal.verified()) {
            throw CommerceException.unauthorized();
        }
    }

    public void requirePermission(CommercePrincipal principal, String permission) {
        requireAuthenticated(principal);
        if (!principal.has(permission)) {
            throw CommerceException.forbidden("missing permission: " + permission);
        }
    }

    public void requireOwner(CommercePrincipal principal, String tenantId, String subjectId) {
        requireAuthenticated(principal);
        if (!principal.tenantId().equals(tenantId) || !principal.subjectId().equals(subjectId)) {
            throw CommerceException.notFound("RESOURCE_NOT_FOUND", "resource is outside the principal scope");
        }
    }

    public void requireStaff(CommercePrincipal principal, String permission) {
        requirePermission(principal, permission);
        if (!principal.servicePrincipal() && principal.subjectId().isBlank()) {
            throw CommerceException.forbidden("staff principal is incomplete");
        }
    }
}
