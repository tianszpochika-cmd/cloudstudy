package com.englishflow.content.web;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ContentLearnerEligibilityTest {

    private static final Instant NOW = Instant.parse("2026-09-23T00:00:00Z");

    @Test
    void preGateProfileTokenCannotReadLearnerContent() {
        assertForbidden(auth("NOT_EVALUATED", "UNKNOWN", List.of("learner.profile.read")));
        assertForbidden(auth("NOT_EVALUATED", "GRANTED", List.of("content.read")));
    }

    @Test
    void consentAndContentPermissionAreBothRequiredAfterAdultGate() {
        assertForbidden(auth("PASSED", "WITHDRAWN", List.of("content.read")));
        assertForbidden(auth("PASSED", "GRANTED", List.of("learner.profile.read")));
        assertForbidden(auth(null, "GRANTED", List.of("content.read")));
    }

    @Test
    void verifiedEligibleLearnerMayReadAndAdminRoleAloneMayNot() {
        assertEquals("principal-1", ContentHttpPrincipals.requireLearnerRead(
                auth("PASSED", "GRANTED", List.of("content.read"))).subject());
        Jwt admin = token("PASSED", "GRANTED", List.of("content.read"), List.of("admin"));
        assertForbidden(new JwtAuthenticationToken(admin, Set.of(), admin.getSubject()));
    }

    private static void assertForbidden(JwtAuthenticationToken authentication) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> ContentHttpPrincipals.requireLearnerRead(authentication));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    private static JwtAuthenticationToken auth(String gate, String consent, List<String> permissions) {
        Jwt jwt = token(gate, consent, permissions, List.of("learner"));
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    private static Jwt token(String gate, String consent, List<String> permissions, List<String> roles) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("principal-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("roles", roles)
                .claim("permissions", permissions);
        if (gate != null) builder.claim("adult_gate", gate);
        if (consent != null) builder.claim("consent_state", consent);
        return builder.build();
    }
}
