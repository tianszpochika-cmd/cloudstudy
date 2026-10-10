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

    /** Learner-only content reads require IAM's explicit Phase 1 eligibility facts. */
    public static VerifiedContentPrincipal requireLearnerRead(Authentication authentication) {
        VerifiedContentPrincipal principal = require(authentication);
        JwtAuthenticationToken jwt = (JwtAuthenticationToken) authentication;
        if (!principal.roles().contains("learner")
                || !principal.permissions().contains("content.read")
                || !"PASSED".equals(jwt.getToken().getClaimAsString("adult_gate"))
                || !"GRANTED".equals(jwt.getToken().getClaimAsString("consent_state"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "learner content access requires adult gate, consent and content.read");
        }
        return principal;
    }

    /**
     * Placement scoring reads {@code answer_rule_json}. Only a service token
     * bound to its own {@code service_id} and granted answer-rule read may call it.
     * A learner access token is not enough.
     */
    public static VerifiedContentPrincipal requirePlacementScore(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "service token is required");
        }
        if (!"service".equals(jwt.getToken().getClaimAsString("token_type"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "placement scoring requires a service token");
        }
        String subject = jwt.getToken().getSubject();
        String serviceId = jwt.getToken().getClaimAsString("service_id");
        if (subject == null || subject.isBlank() || !subject.equals(serviceId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "service identity is not bound");
        }
        VerifiedContentPrincipal principal = require(authentication);
        if (!principal.permissions().contains("content:answer-rules:read")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "placement scoring permission is required");
        }
        return principal;
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
