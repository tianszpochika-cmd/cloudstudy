package com.englishflow.media.web;

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

class MediaHttpPrincipalsTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");

    @Test
    void verifiedLearnerFactsAreReturnedFromTheJwtOnly() {
        MediaHttpPrincipals.VerifiedMediaPrincipal principal = MediaHttpPrincipals.requireJwt(
                authentication(jwt("principal-1", "platform", List.of("learner"), List.of("media.asset.read"))));

        assertEquals("principal-1", principal.subject());
        assertEquals("platform", principal.tenantId());
        assertTrue(principal.permissions().contains("media.asset.read"));
    }

    @Test
    void missingTokenOrSubjectIsUnauthorized() {
        assertEquals(HttpStatus.UNAUTHORIZED, status(() -> MediaHttpPrincipals.requireJwt(null)));
        assertEquals(HttpStatus.UNAUTHORIZED, status(() -> MediaHttpPrincipals.requireJwt(
                new AnonymousAuthenticationToken("key", "anonymous",
                        List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))))));
    }

    @Test
    void missingOrForeignTenantIsForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, status(() -> MediaHttpPrincipals.requireJwt(
                authentication(jwt("principal-1", null, List.of("learner"), List.of("media.asset.read"))))));
        assertEquals(HttpStatus.FORBIDDEN, status(() -> MediaHttpPrincipals.requireJwt(
                authentication(jwt("principal-1", "other", List.of("learner"), List.of("media.asset.read"))))));
    }

    @Test
    void emptyAuthorityClaimsAreForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, status(() -> MediaHttpPrincipals.requireJwt(
                authentication(jwt("principal-1", "platform", List.of(), List.of())))));
    }

    @Test
    void scopeOnlyTokensStillCarryVerifiedPermissions() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("principal-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("scope", "media.asset.read")
                .build();
        MediaHttpPrincipals.VerifiedMediaPrincipal principal =
                MediaHttpPrincipals.requireJwt(authentication(jwt));
        assertTrue(principal.permissions().contains("media.asset.read"));
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
