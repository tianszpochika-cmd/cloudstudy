package com.englishflow.gamification.adapter.http;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import com.englishflow.gamification.application.GamificationAccessPolicy;
import com.englishflow.gamification.domain.GamificationDomainException;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class GamificationPrincipalResolverTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");
    private final GamificationPrincipalResolver resolver =
            new GamificationPrincipalResolver(new GamificationAccessPolicy());

    @Test
    void learnerRequiresPermissionSubjectAndPlatformTenant() {
        assertEquals("principal-1", resolver.requireUser(authentication(jwt("principal-1", "platform",
                List.of("gamification.read"), null))));

        assertEquals("FORBIDDEN", code(() -> resolver.requireUser(authentication(jwt("principal-1", "platform",
                List.of("gamification.other"), null)))));
        assertEquals("UNAUTHORIZED", code(() -> resolver.requireUser(authentication(jwt("principal-1", null,
                List.of("gamification.read"), null)))));
        assertEquals("FORBIDDEN", code(() -> resolver.requireUser(authentication(jwt("principal-1", "other",
                List.of("gamification.read"), null)))));
        assertEquals("UNAUTHORIZED", code(() -> resolver.requireUser(null)));
        assertEquals("UNAUTHORIZED", code(() -> resolver.requireUser(
                new AnonymousAuthenticationToken("key", "anonymous",
                        List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))))));
    }

    @Test
    void rewardClaimerUsesTheSameVerifiedFacts() {
        assertEquals("principal-1", resolver.requireRewardClaimer(authentication(jwt("principal-1", "platform",
                List.of("gamification.rewards.claim"), null))));
        assertEquals("UNAUTHORIZED", code(() -> resolver.requireRewardClaimer(authentication(jwt("principal-1", null,
                List.of("gamification.rewards.claim"), null)))));
        assertEquals("FORBIDDEN", code(() -> resolver.requireRewardClaimer(authentication(jwt("principal-1", "other",
                List.of("gamification.rewards.claim"), null)))));
    }

    @Test
    void trustedEventConsumerRequiresAllowlistedSourceAndTenant() {
        assertEquals("learning-service", resolver.requireTrustedEventConsumer(authentication(jwt("service-1",
                "platform", List.of("gamification.events.consume"), "learning-service"))));
        assertEquals("FORBIDDEN", code(() -> resolver.requireTrustedEventConsumer(authentication(jwt("service-1",
                "platform", List.of("gamification.events.consume"), "unknown-service")))));
        assertEquals("FORBIDDEN", code(() -> resolver.requireTrustedEventConsumer(authentication(jwt("service-1",
                "other", List.of("gamification.events.consume"), "learning-service")))));
    }

    private static Jwt jwt(String subject, String tenant, List<String> permissions, String sourceService) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("permissions", permissions);
        if (tenant != null) builder.claim("tenant_id", tenant);
        if (sourceService != null) builder.claim("source_service", sourceService);
        return builder.build();
    }

    private static JwtAuthenticationToken authentication(Jwt jwt) {
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    private static String code(Runnable action) {
        return assertThrows(GamificationDomainException.class, action::run).code().name();
    }
}
