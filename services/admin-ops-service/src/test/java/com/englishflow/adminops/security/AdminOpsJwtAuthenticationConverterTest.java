package com.englishflow.adminops.security;

import java.time.Instant;
import java.util.List;

import com.englishflow.adminops.domain.AdminPrincipal;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminOpsJwtAuthenticationConverterTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");
    private final AdminOpsJwtAuthenticationConverter converter = new AdminOpsJwtAuthenticationConverter();

    @Test
    void verifiedTokenBecomesAnAdminPrincipalWithPermAndRoleAuthorities() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("principal-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("permissions", List.of("admin.content.review"))
                .claim("roles", List.of("reviewer"))
                .claim("scope", "admin.content.review")
                .build();

        AdminOpsAuthenticationToken authentication = converter.convert(jwt);
        AdminPrincipal principal = authentication.adminPrincipal();

        assertThat(principal.subjectId()).isEqualTo("principal-1");
        assertThat(principal.tenantId()).isEqualTo("platform");
        assertThat(principal.hasPermission("admin.content.review")).isTrue();
        assertThat(principal.hasRole("reviewer")).isTrue();
        assertThat(authorities(authentication)).contains("PERM_admin.content.review", "ROLE_reviewer");
    }

    @Test
    void missingTenantClaimIsRejected() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("principal-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("permissions", List.of("admin.content.review"))
                .build();

        assertThatThrownBy(() -> converter.convert(jwt))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void tokensWithoutAuthorityClaimsProduceAnEmptyPrincipalForPepToDeny() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("principal-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "platform")
                .build();

        AdminPrincipal principal = converter.convert(jwt).adminPrincipal();
        assertThat(principal.permissions()).isEmpty();
        assertThat(principal.roles()).isEmpty();
    }

    private static java.util.Set<String> authorities(AdminOpsAuthenticationToken authentication) {
        return authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .collect(java.util.stream.Collectors.toSet());
    }
}
