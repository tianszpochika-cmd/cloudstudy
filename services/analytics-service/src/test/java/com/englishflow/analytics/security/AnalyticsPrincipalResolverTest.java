package com.englishflow.analytics.security;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import com.englishflow.analytics.domain.AnalyticsDomainException;
import com.englishflow.analytics.domain.AnalyticsErrorCode;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AnalyticsPrincipalResolverTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");
    private final AnalyticsPrincipalResolver resolver = new AnalyticsPrincipalResolver();

    @Test
    void queryCallerRequiresVerifiedJwtAndPermission() {
        AnalyticsCaller caller = resolver.requireQueryCaller(authentication(jwt(
                "principal-1", "platform", List.of("analytics.read"), null, null)));
        assertEquals("platform", caller.tenant().tenantId());
        assertEquals("principal-1", caller.subject());

        assertEquals(AnalyticsErrorCode.FORBIDDEN, code(() -> resolver.requireQueryCaller(authentication(jwt(
                "principal-1", "platform", List.of("analytics.other"), null, null)))));
        assertEquals(AnalyticsErrorCode.UNAUTHENTICATED, code(() -> resolver.requireQueryCaller(null)));
        assertEquals(AnalyticsErrorCode.UNAUTHENTICATED, code(() -> resolver.requireQueryCaller(
                new AnonymousAuthenticationToken("key", "anonymous",
                        List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))))));
    }

    @Test
    void missingTenantOrRevokedFactsAreDenied() {
        assertEquals(AnalyticsErrorCode.UNAUTHENTICATED, code(() -> resolver.requireQueryCaller(authentication(jwt(
                "principal-1", null, List.of("analytics.read"), null, null)))));
        assertEquals(AnalyticsErrorCode.FORBIDDEN, code(() -> resolver.requireQueryCaller(authentication(jwt(
                "principal-1", "platform", List.of("analytics.read"), "true", null)))));
        assertEquals(AnalyticsErrorCode.FORBIDDEN, code(() -> resolver.requireQueryCaller(authentication(jwt(
                "principal-1", "platform", List.of("analytics.read"), null, "SUSPENDED")))));
    }

    @Test
    void trustedEventCallerMustComeFromAnAllowedSourceService() {
        AnalyticsCaller allowed = resolver.requireTrustedEventCaller(authentication(jwt(
                "service-1", "platform", List.of("analytics.events.consume"), null, null, "assessment-service")));
        assertEquals("assessment-service", allowed.sourceService());

        assertEquals(AnalyticsErrorCode.FORBIDDEN, code(() -> resolver.requireTrustedEventCaller(authentication(jwt(
                "service-1", "platform", List.of("analytics.events.consume"), null, null, "unknown-service")))));
        assertEquals(AnalyticsErrorCode.UNAUTHENTICATED, code(() -> resolver.requireTrustedEventCaller(authentication(jwt(
                "service-1", "platform", List.of("analytics.events.consume"), null, null, null)))));
    }

    private static Jwt jwt(String subject, String tenant, List<String> permissions, String revoked,
            String accountStatus) {
        return jwt(subject, tenant, permissions, revoked, accountStatus, null);
    }

    private static Jwt jwt(String subject, String tenant, List<String> permissions, String revoked,
            String accountStatus, String sourceService) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("permissions", permissions);
        if (tenant != null) builder.claim("tenant_id", tenant);
        if (revoked != null) builder.claim("revoked", Boolean.valueOf(revoked));
        if (accountStatus != null) builder.claim("account_status", accountStatus);
        if (sourceService != null) builder.claim("source_service", sourceService);
        return builder.build();
    }

    private static JwtAuthenticationToken authentication(Jwt jwt) {
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    private static AnalyticsErrorCode code(Runnable action) {
        return assertThrows(AnalyticsDomainException.class, action::run).code();
    }
}
