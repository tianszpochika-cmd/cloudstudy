package com.englishflow.social.domain;

/** Default-deny service-side policy enforcement point. */
public final class SocialPep {

    public void requirePermission(SocialPrincipal principal, String permission) {
        if (principal == null) {
            throw SocialDomainException.unauthenticated();
        }
        if (permission == null || permission.isBlank() || !principal.hasPermission(permission)) {
            throw SocialDomainException.forbidden("SOC_PERMISSION_DENIED", "permission denied");
        }
    }

    public void requireTenant(SocialPrincipal principal, String resourceTenantId) {
        if (principal == null) {
            throw SocialDomainException.unauthenticated();
        }
        if (resourceTenantId == null || resourceTenantId.isBlank()) {
            throw SocialDomainException.forbidden("SOC_RESOURCE_TENANT_MISSING", "resource tenant is unavailable");
        }
        if (!principal.tenantId().equals(resourceTenantId)) {
            throw SocialDomainException.forbidden("SOC_TENANT_FORBIDDEN", "resource is outside the subject tenant");
        }
    }

    public void requireOwner(SocialPrincipal principal, String ownerSubjectId) {
        if (principal == null) {
            throw SocialDomainException.unauthenticated();
        }
        if (ownerSubjectId == null || !principal.subjectId().equals(ownerSubjectId)) {
            throw SocialDomainException.forbidden("SOC_OWNER_FORBIDDEN", "only the server-recorded owner may perform this action");
        }
    }

    public void requireWorkload(SocialPrincipal principal) {
        if (principal == null) {
            throw SocialDomainException.unauthenticated();
        }
        if (!principal.isWorkload()) {
            throw SocialDomainException.forbidden("SOC_TRUSTED_SOURCE_REQUIRED", "trusted events require a workload identity");
        }
    }
}
