package com.englishflow.social.security;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SocialJwtAuthenticationConverterTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");
    private static final String SUBJECT = "3f8b1c42-9d2e-4a7b-8c1d-5e6f7a8b9c0d";
    private final SocialJwtAuthenticationConverter converter = new SocialJwtAuthenticationConverter();

    @Test
    void verifiedTokenBecomesASocialPrincipalWithAuthorities() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("phase", "phase-1")
                .claim("consent_granted", true)
                .claim("account_status", "ACTIVE")
                .claim("permissions", List.of("social.room.read", "social.room.join"))
                .claim("roles", List.of("learner"))
                .build();

        SocialAuthenticationToken authentication = converter.convert(jwt);
        SocialPrincipal principal = authentication.socialPrincipal();

        assertThat(principal.subjectId()).isEqualTo(SUBJECT);
        assertThat(principal.tenantId()).isEqualTo("platform");
        assertThat(principal.phase()).isEqualTo("phase-1");
        assertThat(principal.consentGranted()).isTrue();
        assertThat(principal.isUsablePhaseOne()).isTrue();
        assertThat(authorities(authentication)).contains("PERM_social.room.read", "PERM_social.room.join",
                "ROLE_learner");
    }

    @Test
    void missingTenantClaimIsRejectedInsteadOfFallingBackToPlatform() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("permissions", List.of("social.room.read"))
                .build();

        assertThatThrownBy(() -> converter.convert(jwt))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessageContaining("tenant");
    }

    @Test
    void foreignTenantClaimIsRejected() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "other")
                .claim("permissions", List.of("social.room.read"))
                .build();

        assertThatThrownBy(() -> converter.convert(jwt))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void tokensWithoutConsentOrPhaseAreNotUsable() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("permissions", List.of("social.room.read"))
                .build();

        SocialPrincipal principal = converter.convert(jwt).socialPrincipal();
        assertThat(principal.isUsablePhaseOne()).isFalse();
    }

    private static java.util.Set<String> authorities(SocialAuthenticationToken authentication) {
        return authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .collect(java.util.stream.Collectors.toSet());
    }
}
