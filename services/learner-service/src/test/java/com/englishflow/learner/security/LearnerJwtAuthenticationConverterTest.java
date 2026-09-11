package com.englishflow.learner.security;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LearnerJwtAuthenticationConverterTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");

    @Test
    void mapsVerifiedPermissionRoleAndScopeClaimsToAuthorities() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("principal-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("permissions", List.of("learner.profile.read", "learner.goal.write"))
                .claim("roles", List.of("learner"))
                .claim("scope", "learner.profile.read learner.goal.write")
                .build();

        JwtAuthenticationToken authentication = (JwtAuthenticationToken)
                new LearnerJwtAuthenticationConverter().convert(jwt);

        assertTrue(authorities(authentication).contains("learner.profile.read"));
        assertTrue(authorities(authentication).contains("learner.goal.write"));
        assertTrue(authorities(authentication).contains("ROLE_learner"));
        assertTrue(authorities(authentication).contains("SCOPE_learner.profile.read"));
        assertEquals("principal-1", authentication.getName());
    }

    @Test
    void claimsWithoutAuthorityValuesProduceNoAuthorities() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("principal-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("permissions", List.of())
                .claim("roles", " ")
                .build();

        JwtAuthenticationToken authentication = (JwtAuthenticationToken)
                new LearnerJwtAuthenticationConverter().convert(jwt);

        assertTrue(authentication.getAuthorities().isEmpty());
    }

    private static java.util.Set<String> authorities(JwtAuthenticationToken authentication) {
        return authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .collect(java.util.stream.Collectors.toSet());
    }
}
