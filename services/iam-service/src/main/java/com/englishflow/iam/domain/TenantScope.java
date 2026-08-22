package com.englishflow.iam.domain;

import java.util.Objects;

/**
 * Server-derived platform scope. The current Phase 1 tenant is always {@code platform}; the
 * owner is the authenticated principal and can never be supplied by a browser request.
 */
public record TenantScope(PrincipalId subject, String tenantId, PrincipalId owner) {

    public static final String PLATFORM_TENANT = "platform";

    public TenantScope {
        Objects.requireNonNull(subject, "subject");
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(owner, "owner");
        if (!PLATFORM_TENANT.equals(tenantId) || !subject.equals(owner)) {
            throw new IllegalArgumentException("Phase 1 IAM scope must be the server-derived platform scope");
        }
    }

    public static TenantScope derive(PrincipalId principalId) {
        return new TenantScope(principalId, PLATFORM_TENANT, principalId);
    }

    public void rejectClientAuthority(ClientAuthorityClaims claims) {
        if (claims != null && claims.hasOverride()) {
            throw new IamPolicyException(
                    IamDecisionCode.CLIENT_AUTHORITY_OVERRIDE,
                    "iam.authority.client_override_rejected");
        }
    }
}
