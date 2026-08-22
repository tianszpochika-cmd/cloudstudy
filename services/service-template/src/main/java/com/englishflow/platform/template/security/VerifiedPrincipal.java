package com.englishflow.platform.template.security;

import java.util.Objects;

import com.englishflow.platform.template.data.TenantScope;

import org.springframework.security.oauth2.jwt.Jwt;

/** Immutable, verified subject plus the server-derived Phase 1 tenant scope. */
public record VerifiedPrincipal(
        String subjectId,
        TenantScope tenantScope,
        VerifiedClaims claims
) {

    public VerifiedPrincipal {
        if (subjectId == null || subjectId.isBlank()) {
            throw new IllegalArgumentException("verified subject is required");
        }
        Objects.requireNonNull(tenantScope, "tenantScope is required");
        Objects.requireNonNull(claims, "verified claims are required");
        if (!subjectId.equals(claims.subjectId())) {
            throw new IllegalArgumentException("principal subject and claims subject must match");
        }
        if (!"platform".equals(tenantScope.tenantId()) || !subjectId.equals(tenantScope.subjectId())) {
            throw new IllegalArgumentException("tenant scope must be server-derived platform scope");
        }
    }

    /** The only supported tenant derivation in the Phase 1 template. */
    public static VerifiedPrincipal fromVerifiedJwt(Jwt jwt) {
        VerifiedClaims claims = VerifiedClaims.fromVerifiedJwt(jwt);
        return new VerifiedPrincipal(
                claims.subjectId(),
                TenantScope.platform(claims.subjectId()),
                claims);
    }
}
