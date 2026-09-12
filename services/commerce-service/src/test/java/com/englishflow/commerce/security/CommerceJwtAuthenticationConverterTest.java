package com.englishflow.commerce.security;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CommerceJwtAuthenticationConverterTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");

    @Test
    void mapsVerifiedPermissionRoleAndScopeClaimsToAuthorities() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("principal-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("permissions", List.of("commerce.order.read", "commerce.order.write"))
                .claim("roles", List.of("learner"))
                .claim("scope", "commerce.order.read commerce.order.write")
                .build();

        JwtAuthenticationToken authentication = (JwtAuthenticationToken)
                new CommerceJwtAuthenticationConverter().convert(jwt);

        assertTrue(authorities(authentication).contains("commerce.order.read"));
        assertTrue(authorities(authentication).contains("commerce.order.write"));
        assertTrue(authorities(authentication).contains("ROLE_learner"));
        assertTrue(authorities(authentication).contains("SCOPE_commerce.order.read"));
        assertEquals("principal-1", authentication.getName());
    }

    private static java.util.Set<String> authorities(JwtAuthenticationToken authentication) {
        return authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .collect(java.util.stream.Collectors.toSet());
    }
}
