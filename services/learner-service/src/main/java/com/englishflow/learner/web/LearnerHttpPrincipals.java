package com.englishflow.learner.web;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;

import com.englishflow.learner.security.LearnerJwtAuthenticationConverter;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

/**
 * HTTP boundary for verified IAM facts. Every value is read from the already verified JWT only;
 * a missing or foreign tenant, missing learner role or empty permission set is denied instead of
 * falling back to a permissive default. Client headers and query parameters never contribute.
 */
public final class LearnerHttpPrincipals {

    public static final String PLATFORM_TENANT = "platform";
    private static final Pattern SUBJECT = Pattern.compile(
            "prn_[A-Za-z0-9._:-]{15,127}"
                    + "|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}");

    private LearnerHttpPrincipals() {
    }

    public static VerifiedLearnerPrincipal require(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified JWT principal is required");
        }
        Jwt token = jwt.getToken();
        String subject = token.getSubject();
        if (subject == null || !SUBJECT.matcher(subject).matches()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified principal id is missing or invalid");
        }
        String tenant = token.getClaimAsString("tenant_id");
        if (!PLATFORM_TENANT.equals(tenant)) {
            // Phase 1 has no tenant-free learner path: missing or foreign tenants are denied.
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tenant is not allowed");
        }
        Set<String> roles = LearnerJwtAuthenticationConverter.strings(token.getClaim("roles"));
        if (!roles.contains("learner")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "learner role is required");
        }
        Set<String> permissions = LearnerJwtAuthenticationConverter.strings(token.getClaim("permissions"));
        if (permissions.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "verified permissions are required");
        }
        return new VerifiedLearnerPrincipal(subject, tenant, roles, permissions);
    }

    /** Verified identity and authority facts for one request. */
    public record VerifiedLearnerPrincipal(
            String subject,
            String tenantId,
            Set<String> roles,
            Set<String> permissions) {

        public VerifiedLearnerPrincipal {
            roles = roles == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(roles));
            permissions = permissions == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(permissions));
        }
    }
}
