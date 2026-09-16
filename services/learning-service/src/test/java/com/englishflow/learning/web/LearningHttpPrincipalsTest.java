package com.englishflow.learning.web;

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

class LearningHttpPrincipalsTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");

    @Test
    void verifiedLearnerFactsAreReturnedFromTheJwtOnly() {
        LearningHttpPrincipals.VerifiedLearningPrincipal principal = LearningHttpPrincipals.require(
                authentication(jwt("principal-1", "platform", List.of("learner"),
                        List.of("learning.plan.read", "learning.task.write"), "GRANTED")));

        assertEquals("principal-1", principal.subject());
        assertEquals("platform", principal.tenantId());
        assertTrue(principal.hasPermission("learning.plan.read"));
    }

    @Test
    void missingTokenOrSubjectIsUnauthorized() {
        assertEquals(HttpStatus.UNAUTHORIZED, status(() -> LearningHttpPrincipals.require(null)));
        assertEquals(HttpStatus.UNAUTHORIZED, status(() -> LearningHttpPrincipals.require(
                new AnonymousAuthenticationToken("key", "anonymous", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))))));
    }

    @Test
    void missingOrForeignTenantIsForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearningHttpPrincipals.require(
                authentication(jwt("principal-1", null, List.of("learner"), List.of("learning.plan.read"))))));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearningHttpPrincipals.require(
                authentication(jwt("principal-1", "other", List.of("learner"), List.of("learning.plan.read"))))));
    }

    @Test
    void missingLearnerRoleOrEmptyPermissionsIsForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearningHttpPrincipals.require(
                authentication(jwt("principal-1", "platform", List.of("admin"), List.of("learning.plan.read"), "GRANTED")))));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearningHttpPrincipals.require(
                authentication(jwt("principal-1", "platform", List.of("learner"), List.of(), "GRANTED")))));
    }

    @Test
    void ungrantedConsentIsForbidden() {
        // P1-LIVE-009: gated-but-unconsented and withdrawn principals must not
        // reach learning data even with an otherwise valid token.
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearningHttpPrincipals.require(
                authentication(jwt("principal-1", "platform", List.of("learner"), List.of("learning.plan.read"), "UNKNOWN")))));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearningHttpPrincipals.require(
                authentication(jwt("principal-1", "platform", List.of("learner"), List.of("learning.plan.read"), "WITHDRAWN")))));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> LearningHttpPrincipals.require(
                authentication(jwt("principal-1", "platform", List.of("learner"), List.of("learning.plan.read"), null)))));
    }

    private static Jwt jwt(String subject, String tenant, List<String> roles, List<String> permissions, String consentState) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("roles", roles)
                .claim("permissions", permissions);
        if (tenant != null) builder.claim("tenant_id", tenant);
        if (consentState != null) builder.claim("consent_state", consentState);
        return builder.build();
    }

    private static Jwt jwt(String subject, String tenant, List<String> roles, List<String> permissions) {
        return jwt(subject, tenant, roles, permissions, "GRANTED");
    }

    private static JwtAuthenticationToken authentication(Jwt jwt) {
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    private static HttpStatus status(Runnable action) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class, action::run);
        return HttpStatus.valueOf(failure.getStatusCode().value());
    }
}
