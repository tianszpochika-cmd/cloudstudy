package com.englishflow.learner.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import com.englishflow.learner.domain.LearnerAuthorizationException;
import com.englishflow.learner.domain.LearnerDecisionCode;

/**
 * Admin PEP denials must surface as 403, never as 400: a valid JWT without
 * tenant-admin facts is forbidden, not malformed.
 */
class LearnerAdminPrincipalsTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final String UUID_SUBJECT = "3f8b1c42-9d2e-4a7b-8c1d-5e6f7a8b9c0d";

    @Test
    void nonAdminJwtIsDeniedWithAuthorizationException() {
        JwtAuthenticationToken learner = authentication(
                jwt(UUID_SUBJECT, "platform", List.of("learner"), List.of("learner.profile.read")));

        LearnerAuthorizationException read = assertThrows(LearnerAuthorizationException.class,
                () -> LearnerAdminPrincipals.requireRead(learner));
        assertEquals(LearnerDecisionCode.PERMISSION_DENIED, read.code());
        assertThrows(LearnerAuthorizationException.class,
                () -> LearnerAdminPrincipals.requireWrite(learner));
    }

    @Test
    void authorizationExceptionMapsToForbidden() {
        LearnerHttpExceptionHandler handler = new LearnerHttpExceptionHandler();
        ResponseEntity<Map<String, Object>> response = handler.authorization(
                new LearnerAuthorizationException(LearnerDecisionCode.PERMISSION_DENIED));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void platformAdminPasses() {
        LearnerAdminPrincipals.AdminPrincipal principal = LearnerAdminPrincipals.requireWrite(
                authentication(jwt(UUID_SUBJECT, "platform",
                        List.of("platform-admin"), List.of("learner.profile.read"))));

        assertEquals(UUID_SUBJECT, principal.subjectId());
        assertTrue(principal.roles().contains("platform-admin"));
    }

    private static Jwt jwt(String subject, String tenant, List<String> roles, List<String> permissions) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("roles", roles)
                .claim("permissions", permissions);
        if (tenant != null) {
            builder.claim("tenant_id", tenant);
        }
        return builder.build();
    }

    private static JwtAuthenticationToken authentication(Jwt jwt) {
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }
}
