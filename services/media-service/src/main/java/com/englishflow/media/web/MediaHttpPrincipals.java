package com.englishflow.media.web;

import java.util.LinkedHashSet;
import java.util.Set;

import com.englishflow.media.security.MediaJwtAuthenticationConverter;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

/**
 * HTTP boundary for verified IAM facts. Every value is read from the already verified JWT only;
 * a missing or foreign tenant and an empty authority set are denied instead of falling back to a
 * permissive default. Client headers and query parameters never contribute.
 */
public final class MediaHttpPrincipals {

    public static final String PLATFORM_TENANT = "platform";

    private MediaHttpPrincipals() {
    }

    public static VerifiedMediaPrincipal requireJwt(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified JWT principal is required");
        }
        Jwt token = jwt.getToken();
        String subject = token.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "subject is missing");
        }
        String tenant = token.getClaimAsString("tenant_id");
        if (!PLATFORM_TENANT.equals(tenant)) {
            // Phase 1 has no tenant-free media path: missing or foreign tenants are denied.
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tenant is not allowed");
        }
        Set<String> roles = MediaJwtAuthenticationConverter.strings(token.getClaim("roles"));
        Set<String> permissions = new LinkedHashSet<>(
                MediaJwtAuthenticationConverter.strings(token.getClaim("permissions")));
        for (String scope : MediaJwtAuthenticationConverter.strings(token.getClaim("scope"))) {
            for (String value : scope.split(" ")) {
                if (!value.isBlank()) permissions.add(value);
            }
        }
        if (roles.isEmpty() && permissions.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "verified authority claims are required");
        }
        return new VerifiedMediaPrincipal(subject, tenant, roles, Set.copyOf(permissions));
    }

    /** Verified identity and authority facts for one request. */
    public record VerifiedMediaPrincipal(
            String subject,
            String tenantId,
            Set<String> roles,
            Set<String> permissions) {

        public VerifiedMediaPrincipal {
            roles = roles == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(roles));
            permissions = permissions == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(permissions));
        }
    }
}
