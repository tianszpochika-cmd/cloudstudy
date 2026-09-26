package com.englishflow.learner.web;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LearnerHttpPrincipalsTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");
    private static final String UUID_SUBJECT = "3f8b1c42-9d2e-4a7b-8c1d-5e6f7a8b9c0d";

    @Test
    void verifiedLearnerFactsAreReturnedFromTheJwtOnly() {
        LearnerHttpPrincipals.VerifiedLearnerPrincipal principal = LearnerHttpPrincipals.require(
                authentication(jwt(UUID_SUBJECT, "platform", List.of("learner"), List.of("learner.profile.read"))));

        assertEquals(UUID_SUBJECT, principal.subject());
        assertEquals("platform", principal.tenantId());
        assertTrue(principal.permissions().contains("learner.profile.read"));
    }

    @Test
    void missingTokenOrSubjectIsUnauthorized() {
        assertEquals(HttpStatus.UNAUTHORIZED, status(() -> LearnerHttpPrincipals.require(null)));
        assertEquals(HttpStatus.UNAUTHORIZED, status(() -> LearnerHttpPrincipals.require(
                new AnonymousAuthenticationToken("key", "anonymous",
                        List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))))));
        assertEquals(HttpStatus.UNAUTHORIZED, status(() -> LearnerHttpPrincipals.require(
                authentication(jwt("not-a-principal", "platform", List.of("learner"), List.of("learner.profile.read"))))));
    }

    @Test
    void missingOrForeignTenantIsForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearnerHttpPrincipals.require(
                authentication(jwt(UUID_SUBJECT, null, List.of("learner"), List.of("learner.profile.read"))))));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearnerHttpPrincipals.require(
                authentication(jwt(UUID_SUBJECT, "other", List.of("learner"), List.of("learner.profile.read"))))));
    }

    @Test
    void missingLearnerRoleOrEmptyPermissionsIsForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearnerHttpPrincipals.require(
                authentication(jwt(UUID_SUBJECT, "platform", List.of("editor"), List.of("learner.profile.read"))))));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearnerHttpPrincipals.require(
                authentication(jwt(UUID_SUBJECT, "platform", List.of("learner"), List.of())))));
    }

    @Test
    void learningAccessRequiresPassedAdultGateAndGrantedConsentEvenForProfilePermissions() {
        List<String> profilePermissions = List.of("learner.profile.read", "learner.profile.write");
        for (String adultGate : new String[]{null, "NOT_EVALUATED", "REJECTED", "APPROVED"}) {
            assertEquals(HttpStatus.FORBIDDEN, status(() -> LearnerHttpPrincipals.requireLearningAccess(
                    authentication(jwt(UUID_SUBJECT, "platform", List.of("learner"), profilePermissions,
                            adultGate, "GRANTED")), "learner.profile.read")));
        }
        for (String consent : new String[]{null, "UNKNOWN", "WITHDRAWN", "ACCEPTED"}) {
            assertEquals(HttpStatus.FORBIDDEN, status(() -> LearnerHttpPrincipals.requireLearningAccess(
                    authentication(jwt(UUID_SUBJECT, "platform", List.of("learner"), profilePermissions,
                            "PASSED", consent)), "learner.profile.read")));
        }
    }

    @Test
    void learningAccessRequiresTheEndpointPermissionFromAValidToken() {
        JwtAuthenticationToken authentication = authentication(jwt(UUID_SUBJECT, "platform",
                List.of("learner"), List.of("learner.profile.read"), "PASSED", "GRANTED"));

        assertEquals(UUID_SUBJECT,
                LearnerHttpPrincipals.requireLearningAccess(authentication, "learner.profile.read").subject());
        assertEquals(HttpStatus.FORBIDDEN,
                status(() -> LearnerHttpPrincipals.requireLearningAccess(authentication, "learner.profile.write")));
        assertEquals(HttpStatus.FORBIDDEN,
                status(() -> LearnerHttpPrincipals.requireLearningAccess(authentication, null)));
    }

    private static Jwt jwt(String subject, String tenant, List<String> roles, List<String> permissions) {
        return jwt(subject, tenant, roles, permissions, null, null);
    }

    private static Jwt jwt(String subject, String tenant, List<String> roles, List<String> permissions,
            String adultGate, String consentState) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("roles", roles)
                .claim("permissions", permissions);
        if (tenant != null) builder.claim("tenant_id", tenant);
        if (adultGate != null) builder.claim("adult_gate", adultGate);
        if (consentState != null) builder.claim("consent_state", consentState);
        return builder.build();
    }

    private static JwtAuthenticationToken authentication(Jwt jwt) {
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    private static HttpStatus status(Runnable action) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class, action::run);
        return HttpStatus.valueOf(failure.getStatusCode().value());
    }
}
