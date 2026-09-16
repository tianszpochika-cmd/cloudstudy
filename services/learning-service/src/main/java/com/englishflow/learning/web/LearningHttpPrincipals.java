package com.englishflow.learning.web;

import java.util.LinkedHashSet;
import java.util.Set;

import com.englishflow.learning.security.LearningJwtAuthenticationConverter;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

/**
 * HTTP boundary for verified IAM facts. Every value is read from the already verified JWT only;
 * a missing tenant, role or permission claim is denied instead of falling back to a permissive
 * default. Client headers and query parameters never contribute.
 */
public final class LearningHttpPrincipals {

    public static final String PLATFORM_TENANT = "platform";

    private LearningHttpPrincipals() {
    }

    public static VerifiedLearningPrincipal require(Authentication authentication) {
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
            // Phase 1 has no tenant-free learning path: missing or foreign tenants are denied.
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tenant is not allowed");
        }
        Set<String> roles = strings(token.getClaim("roles"));
        if (!roles.contains("learner")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "learner role is required");
        }
        Set<String> permissions = strings(token.getClaim("permissions"));
        if (permissions.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "verified permissions are required");
        }
        // P1-LIVE-009: learning data requires granted consent, evaluated from the
        // issuance-time claim like the learner boundary does. Without this, gated
        // but unconsented principals could write SRS state with a stripped token.
        String consent = firstText(token, "consent_state", "consentState", "consent");
        if (!"GRANTED".equalsIgnoreCase(consent)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "consent is required");
        }
        return new VerifiedLearningPrincipal(subject, tenant, roles, permissions);
    }

    private static String firstText(Jwt token, String... names) {
        for (String name : names) {
            String value = token.getClaimAsString(name);
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static Set<String> strings(Object claim) {
        return LearningJwtAuthenticationConverter.strings(claim);
    }

    /** Verified identity and authority facts for one request. */
    public record VerifiedLearningPrincipal(
            String subject,
            String tenantId,
            Set<String> roles,
            Set<String> permissions) {

        public VerifiedLearningPrincipal {
            roles = roles == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(roles));
            permissions = permissions == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(permissions));
        }

        public boolean hasPermission(String permission) {
            return permission != null && permissions.contains(permission);
        }
    }
}
