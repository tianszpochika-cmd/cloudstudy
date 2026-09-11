package com.englishflow.content.web;

import java.time.Instant;
import java.util.List;

import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentOperationException;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VerifiedContentPrincipalFactoryTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");
    private final VerifiedContentPrincipalFactory factory = new VerifiedContentPrincipalFactory();

    @Test
    void verifiedEditorFactsAreDerivedFromTheJwtOnly() {
        ContentActor actor = factory.from(authentication(jwt("principal-1", "platform",
                List.of("editor"), List.of("content.draft.write"))));

        assertEquals("principal-1", actor.subjectId());
        assertEquals("platform", actor.tenantId());
        assertTrue(actor.roles().contains("editor"));
        assertTrue(actor.permissions().contains("content.draft.write"));
    }

    @Test
    void missingOrForeignTenantIsDenied() {
        assertEquals("CONTENT_TENANT_DENIED", code(() -> factory.from(authentication(jwt("principal-1", null,
                List.of("editor"), List.of("content.draft.write"))))));
        assertEquals("CONTENT_TENANT_DENIED", code(() -> factory.from(authentication(jwt("principal-1", "other",
                List.of("editor"), List.of("content.draft.write"))))));
    }

    @Test
    void emptyAuthorityClaimsAreDenied() {
        assertEquals("CONTENT_AUTHORITIES_REQUIRED", code(() -> factory.from(authentication(jwt("principal-1",
                "platform", List.of(), List.of())))));
    }

    @Test
    void anonymousAuthenticationIsDenied() {
        assertThrows(ContentOperationException.class, () -> factory.from(
                new AnonymousAuthenticationToken("key", "anonymous",
                        List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")))));
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
        return new JwtAuthenticationToken(jwt, java.util.Set.of(), jwt.getSubject());
    }

    private static String code(Runnable action) {
        return assertThrows(ContentOperationException.class, action::run).code();
    }
}
