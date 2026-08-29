package com.englishflow.learner.web;

import com.englishflow.learner.config.LearnerServiceProperties;
import com.englishflow.learner.domain.ClientAuthorityClaims;
import com.englishflow.learner.domain.ConsentState;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerPrincipalContext;
import com.englishflow.learner.domain.LearnerTenantScope;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Converts only a Resource Server verified JWT into domain authority facts.
 * No request header, query parameter or request body is consulted here.
 */
public final class VerifiedLearnerPrincipalFactory {

    private final LearnerServiceProperties properties;

    public VerifiedLearnerPrincipalFactory(LearnerServiceProperties properties) {
        this.properties = properties;
    }

    public LearnerPrincipalContext from(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)
                || !jwtAuthentication.isAuthenticated()) {
            throw new LearnerDomainException(LearnerDecisionCode.MISSING_PRINCIPAL,
                    "a verified JWT principal is required");
        }
        Jwt jwt = jwtAuthentication.getToken();
        String mappedPrincipalId = firstText(jwt, "principal_id", "principalId");
        String principalId = mappedPrincipalId != null ? mappedPrincipalId : firstText(jwt, "sub");
        boolean validMappedPrincipal = mappedPrincipalId != null
                && mappedPrincipalId.matches("prn_[A-Za-z0-9._:-]{15,127}");
        boolean validJwtSubject = mappedPrincipalId == null && principalId != null
                && principalId.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}");
        if (principalId == null || (!validMappedPrincipal && !validJwtSubject)) {
            throw new LearnerDomainException(LearnerDecisionCode.MISSING_PRINCIPAL,
                    "verified JWT is missing an IAM principal id");
        }

        Set<String> roles = new LinkedHashSet<>();
        Set<String> permissions = new LinkedHashSet<>();
        jwtAuthentication.getAuthorities().forEach(authority -> {
            String value = authority.getAuthority();
            if (value.startsWith("ROLE_")) {
                roles.add(value.substring("ROLE_".length()));
            } else if (value.startsWith("SCOPE_")) {
                permissions.add(value.substring("SCOPE_".length()));
            } else if (!value.isBlank()) {
                permissions.add(value);
            }
        });
        roles.addAll(claimValues(jwt, "roles"));
        permissions.addAll(claimValues(jwt, "permissions"));
        String consent = firstText(jwt, "consent_state", "consentState", "consent");
        String adultGate = firstText(jwt, "adult_gate", "adultGate");
        ConsentState consentState = "GRANTED".equalsIgnoreCase(consent)
                || "PASSED".equalsIgnoreCase(adultGate)
                || Boolean.TRUE.equals(jwt.getClaim("adult_gate_passed"))
                ? ConsentState.GRANTED
                : "WITHDRAWN".equalsIgnoreCase(consent) ? ConsentState.WITHDRAWN : ConsentState.UNKNOWN;
        boolean revoked = Boolean.TRUE.equals(jwt.getClaim("revoked"))
                || "REVOKED".equalsIgnoreCase(firstText(jwt, "status"));
        return new LearnerPrincipalContext(
                LearnerTenantScope.forPhaseOne(principalId), properties.getPhase(), roles, permissions,
                consentState, revoked, ClientAuthorityClaims.none());
    }

    private static String firstText(Jwt jwt, String... names) {
        for (String name : names) {
            String value = jwt.getClaimAsString(name);
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static Set<String> claimValues(Jwt jwt, String name) {
        Object value = jwt.getClaims().get(name);
        if (value instanceof Collection<?> collection) {
            Set<String> values = new LinkedHashSet<>();
            collection.forEach(item -> {
                if (item instanceof String text && !text.isBlank()) {
                    values.add(text.trim());
                }
            });
            return values;
        }
        if (value instanceof String text && !text.isBlank()) {
            return Set.of(text.trim());
        }
        return Set.of();
    }
}
