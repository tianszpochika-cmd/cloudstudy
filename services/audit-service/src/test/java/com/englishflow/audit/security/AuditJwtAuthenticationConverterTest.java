package com.englishflow.audit.security;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuditJwtAuthenticationConverterTest {

    private static final Instant NOW = Instant.parse("2026-09-12T00:00:00Z");

    @Test
    void mapsVerifiedPermissionRoleAndScopeClaimsToAuthorities() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("service-audit")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("permissions", List.of("audit.ingest", "audit.read"))
                .claim("roles", List.of("auditor"))
                .claim("scope", "audit.ingest")
                .build();

        JwtAuthenticationToken authentication = (JwtAuthenticationToken)
                new AuditJwtAuthenticationConverter().convert(jwt);

        assertTrue(authorities(authentication).contains("audit.ingest"));
        assertTrue(authorities(authentication).contains("ROLE_auditor"));
        assertTrue(authorities(authentication).contains("SCOPE_audit.ingest"));
        assertEquals("service-audit", authentication.getName());
    }

    private static java.util.Set<String> authorities(JwtAuthenticationToken authentication) {
        return authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .collect(java.util.stream.Collectors.toSet());
    }
}
