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
                        List.of("assessment.session.read", "assessment.answer.write"))));

        assertEquals("principal-1", principal.subject());
        assertEquals("platform", principal.tenantId());
        assertTrue(principal.hasPermission("assessment.session.read"));
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

    private static Jwt jwt(String subject, String tenant, List<String> roles, List<String> permissions) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("roles", roles)
                .claim("permissions", permissions);
        if (tenant != null) builder.claim("tenant_id", tenant);
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
