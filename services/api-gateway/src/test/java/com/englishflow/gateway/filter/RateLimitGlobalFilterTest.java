package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import com.englishflow.gateway.rate.RateLimitBackend;
import com.englishflow.gateway.rate.RateLimitDecision;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RateLimitGlobalFilterTest {

    @Test
    void sensitiveAdmissionClassesRequireASecondIpOnlyBudget() {
        for (AdmissionRoute route : List.of(
                new AdmissionRoute("/api/v1/auth/register", "auth-register"),
                new AdmissionRoute("/api/v1/auth/login", "auth-login"),
                new AdmissionRoute("/api/v1/auth/password-reset/challenge", "password-reset")
        )) {
            CapturingBackend backend = new CapturingBackend();
            var exchange = exchange(route.path(), "account-a", "device-a");
            boolean[] reached = new boolean[1];

            filter(backend, route.policyKey(), 2).filter(exchange, forwarded -> {
                reached[0] = true;
                return Mono.empty();
            }).block();

            assertTrue(reached[0], route.path());
            assertEquals(2, backend.keys.size(), route.path());
            assertTrue(backend.keys.getFirst().startsWith("ip-auth-admission:"), route.path());
            assertTrue(backend.keys.getFirst().endsWith(":" + route.policyKey()), route.path());
            assertTrue(backend.keys.get(1).startsWith("ip-device-account:"), route.path());
        }
    }

    @Test
    void rotatingDeviceAndAccountCannotBypassIpTotalBudget() {
        CapturingBackend backend = new CapturingBackend();
        boolean[] firstReached = new boolean[1];
        var first = exchange("/api/v1/auth/login", "account-a", "device-a");
        filter(backend, "auth-login", 1).filter(first, forwarded -> {
            firstReached[0] = true;
            return Mono.empty();
        }).block();

        boolean[] secondReached = new boolean[1];
        var second = exchange("/api/v1/auth/login", "account-b", "device-b");
        filter(backend, "auth-login", 1).filter(second, forwarded -> {
            secondReached[0] = true;
            return Mono.empty();
        }).block();

        assertTrue(firstReached[0]);
        assertFalse(secondReached[0]);
        assertEquals(429, second.getResponse().getStatusCode().value());
        assertTrue(second.getResponse().getHeaders().getFirst("Retry-After") != null);
        assertEquals(3, backend.keys.size());
        assertEquals(backend.keys.getFirst(), backend.keys.get(2));
        assertNotEquals(backend.keys.getFirst(), backend.keys.get(1));
    }

    @Test
    void eitherSensitiveBudgetBackendFailureReturns503() {
        for (boolean failIpBudget : List.of(true, false)) {
            CapturingBackend backend = new CapturingBackend();
            backend.failIpBudget = failIpBudget;
            backend.failCompositeBudget = !failIpBudget;
            var exchange = exchange("/api/v1/auth/login", "account-a", "device-a");
            boolean[] reached = new boolean[1];

            filter(backend, "auth-login", 1).filter(exchange, forwarded -> {
                reached[0] = true;
                return Mono.empty();
            }).block();

            assertFalse(reached[0]);
            assertEquals(503, exchange.getResponse().getStatusCode().value());
            assertEquals("unavailable", exchange.getResponse().getHeaders().getFirst("X-RateLimit-Backend"));
        }
    }

    @Test
    void delayedAndNeverBackendResponsesTimeOutFailClosedWith503() {
        for (StalledBackend.Mode mode : StalledBackend.Mode.values()) {
            for (int successfulConsumesBeforeStall : List.of(0, 1)) {
                StalledBackend backend = new StalledBackend(mode, successfulConsumesBeforeStall);
                var exchange = exchange("/api/v1/auth/login", "account-a", "device-a");
                boolean[] reached = new boolean[1];

                filter(backend, "auth-login", 1, Duration.ofMillis(100)).filter(exchange, forwarded -> {
                    reached[0] = true;
                    return Mono.empty();
                }).block(Duration.ofSeconds(2));

                assertFalse(reached[0], mode.name());
                assertEquals(successfulConsumesBeforeStall + 1, backend.consumeCount(), mode.name());
                assertEquals(503, exchange.getResponse().getStatusCode().value(), mode.name());
                assertEquals("unavailable", exchange.getResponse().getHeaders().getFirst("X-RateLimit-Backend"), mode.name());
                assertTrue(exchange.getResponse().getBodyAsString().block()
                        // The internal audit reason stays specific, while the
                        // external response is constrained by the OpenAPI enum.
                        .contains("\"errorCode\":\"SERVICE_UNAVAILABLE\""), mode.name());
            }
        }
    }

    @Test
    void providerCallbackBucketDerivesProviderAndRouteFromCanonicalRule() {
        List<String> keys = new ArrayList<>();
        for (String path : List.of(
                "/api/v1/commerce/wechat/callback",
                "/api/v1/commerce/alipay/notify",
                "/api/v1/commerce/apple/notifications"
        )) {
            CapturingBackend backend = new CapturingBackend();
            var exchange = MockServerWebExchange.from(MockServerHttpRequest.post(path)
                    .remoteAddress(new InetSocketAddress("192.0.2.10", 12345)).build());

            filter(backend, "provider-callback", 2).filter(exchange, forwarded -> Mono.empty()).block();
            assertEquals(1, backend.keys.size());
            assertTrue(backend.keys.getFirst().startsWith("provider-route:"));
            keys.add(backend.keys.getFirst());
        }

        assertEquals(3, keys.stream().distinct().count());
    }

    @Test
    void rateLimitWindowMustBeStrictlyPositive() {
        assertFalse(new GatewayProperties.RateLimitPolicy(1, Duration.ZERO).isWindowStrictlyPositive());
        assertFalse(new GatewayProperties.RateLimitPolicy(1, Duration.ofSeconds(-1)).isWindowStrictlyPositive());
        assertTrue(new GatewayProperties.RateLimitPolicy(1, Duration.ofMillis(1)).isWindowStrictlyPositive());
    }

    @Test
    void rateLimitBackendTimeoutMustBeStrictlyPositive() {
        assertFalse(rateLimit(Duration.ZERO).isBackendTimeoutStrictlyPositive());
        assertFalse(rateLimit(Duration.ofMillis(-1)).isBackendTimeoutStrictlyPositive());
        assertTrue(rateLimit(Duration.ofMillis(1)).isBackendTimeoutStrictlyPositive());
    }

    private static RateLimitGlobalFilter filter(RateLimitBackend backend, String policyKey, int requests) {
        return filter(backend, policyKey, requests, Duration.ofMillis(750));
    }

    private static RateLimitGlobalFilter filter(
            RateLimitBackend backend,
            String policyKey,
            int requests,
            Duration backendTimeout
    ) {
        GatewayProperties properties = mock(GatewayProperties.class);
        GatewayProperties.Cors cors = mock(GatewayProperties.Cors.class);
        when(properties.rateLimit()).thenReturn(new GatewayProperties.RateLimit(
                true,
                "memory",
                32,
                false,
                backendTimeout,
                Map.of(policyKey, new GatewayProperties.RateLimitPolicy(requests, Duration.ofMinutes(1)))
        ));
        when(properties.requestContext()).thenReturn(new GatewayProperties.RequestContext(128));
        when(properties.cors()).thenReturn(cors);
        when(cors.refreshCookieName()).thenReturn("yuxuexing_refresh");
        return new RateLimitGlobalFilter(properties, new GatewayRoutePolicy(), backend, new ObjectMapper());
    }

    private static GatewayProperties.RateLimit rateLimit(Duration backendTimeout) {
        return new GatewayProperties.RateLimit(
                true,
                "memory",
                1,
                false,
                backendTimeout,
                Map.of()
        );
    }

    private static MockServerWebExchange exchange(String path, String account, String device) {
        return MockServerWebExchange.from(MockServerHttpRequest.post(path)
                .remoteAddress(new InetSocketAddress("192.0.2.10", 12345))
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Device-Id", device)
                .body("{\"identifier\":\"" + account + "\"}"));
    }

    private record AdmissionRoute(String path, String policyKey) {
    }

    private static final class CapturingBackend implements RateLimitBackend {
        private final List<String> keys = new ArrayList<>();
        private final Map<String, Integer> counts = new LinkedHashMap<>();
        private boolean failIpBudget;
        private boolean failCompositeBudget;

        @Override
        public Mono<RateLimitDecision> consume(String key, GatewayProperties.RateLimitPolicy policy) {
            keys.add(key);
            if (failIpBudget && key.startsWith("ip-auth-admission:")) {
                return Mono.error(new IllegalStateException("test backend unavailable"));
            }
            if (failCompositeBudget && key.startsWith("ip-device-account:")) {
                return Mono.error(new IllegalStateException("test backend unavailable"));
            }
            int count = counts.merge(key, 1, Integer::sum);
            boolean allowed = count <= policy.requestsPerWindow();
            return Mono.just(new RateLimitDecision(
                    allowed,
                    policy.requestsPerWindow(),
                    Math.max(0, policy.requestsPerWindow() - count),
                    Instant.now().plusSeconds(30).getEpochSecond()
            ));
        }
    }

    private static final class StalledBackend implements RateLimitBackend {
        enum Mode { DELAYED, NEVER }

        private final Mode mode;
        private final int successfulConsumesBeforeStall;
        private int consumeCount;

        private StalledBackend(Mode mode, int successfulConsumesBeforeStall) {
            this.mode = mode;
            this.successfulConsumesBeforeStall = successfulConsumesBeforeStall;
        }

        @Override
        public Mono<RateLimitDecision> consume(String key, GatewayProperties.RateLimitPolicy policy) {
            consumeCount++;
            if (consumeCount <= successfulConsumesBeforeStall) {
                return Mono.just(new RateLimitDecision(true, 1, 0, Instant.now().plusSeconds(30).getEpochSecond()));
            }
            return switch (mode) {
                case DELAYED -> Mono.delay(Duration.ofSeconds(10))
                        .map(ignored -> new RateLimitDecision(true, 1, 0, Instant.now().plusSeconds(30).getEpochSecond()));
                case NEVER -> Mono.never();
            };
        }

        int consumeCount() {
            return consumeCount;
        }
    }
}
