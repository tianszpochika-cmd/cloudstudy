package com.englishflow.assessment.web;

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

class AssessmentHttpPrincipalsTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");

    @Test
    void verifiedLearnerFactsAreReturnedFromTheJwtOnly() {
        AssessmentHttpPrincipals.VerifiedAssessmentPrincipal principal = AssessmentHttpPrincipals.require(
                authentication(jwt("principal-1", "platform", List.of("learner"),
                        List.of("assessment.session.read", "assessment.session.write"))),
                "assessment.session.read");

        assertEquals("principal-1", principal.subject());
        assertEquals("platform", principal.tenantId());
        assertTrue(principal.hasPermission("assessment.session.read"));
        assertTrue(principal.hasPermission("assessment.session.write"));
    }

    @Test
    void missingTokenOrSubjectIsUnauthorized() {
        assertEquals(HttpStatus.UNAUTHORIZED, status(() -> AssessmentHttpPrincipals.require(null)));
        assertEquals(HttpStatus.UNAUTHORIZED, status(() -> AssessmentHttpPrincipals.require(
                new AnonymousAuthenticationToken("key", "anonymous",
                        List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))))));
    }

    @Test
    void missingOrForeignTenantIsForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, status(() -> AssessmentHttpPrincipals.require(
                authentication(jwt("principal-1", null, List.of("learner"), List.of("assessment.session.read"))))));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> AssessmentHttpPrincipals.require(
                authentication(jwt("principal-1", "other", List.of("learner"), List.of("assessment.session.read"))))));
    }

    @Test
    void missingLearnerRoleOrEmptyPermissionsIsForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, status(() -> AssessmentHttpPrincipals.require(
                authentication(jwt("principal-1", "platform", List.of("admin"), List.of("assessment.session.read"))))));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> AssessmentHttpPrincipals.require(
                authentication(jwt("principal-1", "platform", List.of("learner"), List.of())))));
    }

    @Test
    void preGateProfileOnlyTokenCannotAccessAssessment() {
        Jwt profileOnly = jwt("principal-1", "platform", List.of("learner"),
                List.of("learner.profile.read", "learner.profile.write"), null, null);
        assertEquals(HttpStatus.FORBIDDEN, status(() -> AssessmentHttpPrincipals.require(
                authentication(profileOnly), "assessment.session.read")));
        Jwt forgedAssessmentPermission = jwt("principal-1", "platform", List.of("learner"),
                List.of("assessment.session.write"), null, null);
        assertEquals(HttpStatus.FORBIDDEN, status(() -> AssessmentHttpPrincipals.require(
                authentication(forgedAssessmentPermission), "assessment.session.write")));
    }

    @Test
    void missingOrWithdrawnConsentCannotAccessAssessment() {
        for (String consent : new String[] { null, "WITHDRAWN", "UNKNOWN" }) {
            Jwt token = jwt("principal-1", "platform", List.of("learner"),
                    List.of("assessment.session.read", "assessment.session.write"), "PASSED", consent);
            assertEquals(HttpStatus.FORBIDDEN, status(() -> AssessmentHttpPrincipals.require(
                    authentication(token), "assessment.session.read")));
        }
    }

    @Test
    void validGateAndConsentStillRequireTheSpecificPermission() {
        Jwt readOnly = jwt("principal-1", "platform", List.of("learner"),
                List.of("assessment.session.read"));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> AssessmentHttpPrincipals.require(
                authentication(readOnly), "assessment.session.write")));
        Jwt writeOnly = jwt("principal-1", "platform", List.of("learner"),
                List.of("assessment.session.write"));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> AssessmentHttpPrincipals.require(
                authentication(writeOnly), "assessment.session.read")));
        assertEquals("principal-1", AssessmentHttpPrincipals.require(
                authentication(writeOnly), "assessment.session.write").subject());
    }

    private static Jwt jwt(String subject, String tenant, List<String> roles, List<String> permissions) {
        return jwt(subject, tenant, roles, permissions, "PASSED", "GRANTED");
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
