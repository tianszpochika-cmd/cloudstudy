package com.englishflow.content.web;

import java.util.LinkedHashSet;
import java.util.Set;

import com.englishflow.content.security.ContentJwtAuthenticationConverter;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

/**
 * HTTP boundary for verified IAM facts. Only the already verified JWT contributes; a missing
 * tenant or empty authority set is denied instead of falling back to a permissive default.
 */
public final class ContentHttpPrincipals {

    public static final String PLATFORM_TENANT = "platform";

    private ContentHttpPrincipals() {
    }

    public static VerifiedContentPrincipal require(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified JWT principal is required");
        }
        String subject = jwt.getToken().getSubject();
        if (subject == null || subject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "subject is missing");
        }
        String tenant = jwt.getToken().getClaimAsString("tenant_id");
        if (!PLATFORM_TENANT.equals(tenant)) {
            // Phase 1 has no tenant-free content path: missing or foreign tenants are denied.
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tenant is not allowed");
        }
        Set<String> roles = ContentJwtAuthenticationConverter.strings(jwt.getToken().getClaim("roles"));
        Set<String> permissions = ContentJwtAuthenticationConverter.strings(jwt.getToken().getClaim("permissions"));
        if (roles.isEmpty() && permissions.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "verified authority claims are required");
        }
        return new VerifiedContentPrincipal(subject, tenant, roles, permissions);
    }

    /** Verified identity and authority facts for one request. */
    public record VerifiedContentPrincipal(
            String subject,
            String tenantId,
            Set<String> roles,
            Set<String> permissions) {

        public VerifiedContentPrincipal {
            roles = roles == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(roles));
            permissions = permissions == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(permissions));
        }
    }
}
