package com.englishflow.gateway;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.rate.RateLimitBackend;
import com.englishflow.gateway.rate.RateLimitDecision;
import com.englishflow.gateway.support.SecurityAuditRecord;
import com.englishflow.gateway.support.SecurityAuditSink;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Process-level Gateway boundary checks. They exercise the running WebFlux
 * pipeline with an in-process admission backend; they do not claim a browser,
 * IAM JWKS, durable audit service, or distributed Redis runtime.
 */
@SpringBootTest(
        classes = ApiGatewayApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "gateway.security.resource-server-enabled=false",
                "gateway.security.jwt-prevalidation-enabled=false",
                "gateway.rate-limit.enabled=true",
                "gateway.rate-limit.backend=memory",
                "gateway.compatibility.enabled=false",
                "gateway.b12.enabled=false",
                "gateway.b13.enabled=false",
                "management.otlp.metrics.export.enabled=false",
                "management.tracing.export.enabled=false"
        }
)
@Import(GatewayBoundaryProcessTest.BoundaryTestConfiguration.class)
class GatewayBoundaryProcessTest {

    private static final String LEARNER_ORIGIN = "http://127.0.0.1:18180";

    @org.springframework.beans.factory.annotation.Autowired
    private ApplicationContext applicationContext;

    private WebTestClient webTestClient;

    @org.springframework.beans.factory.annotation.Autowired
    private ControllableRateLimitBackend rateLimitBackend;

    @org.springframework.beans.factory.annotation.Autowired
    private CapturingSecurityAuditSink auditSink;

    @BeforeEach
    void resetBoundaryDoubles() {
        webTestClient = WebTestClient.bindToApplicationContext(applicationContext)
                .configureClient()
                .baseUrl("http://127.0.0.1:18070")
                .build();
        rateLimitBackend.mode = ControllableRateLimitBackend.Mode.ALLOW;
        auditSink.clear();
    }

    @Test
    void protectedRouteReturnsCanonical401WithCorrelationIds() {
        webTestClient.get()
                .uri("/api/v1/learner/profile")
                .header("X-Request-Id", "gateway-401-test")
                .header("X-Trace-Id", "trace-401-test")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals("X-Request-Id", "gateway-401-test")
                .expectHeader().valueEquals("X-Trace-Id", "trace-401-test")
                .expectHeader().valueEquals(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
                .expectBody()
                .jsonPath("$.error.code").isEqualTo("unauthorized");

        assertTrue(auditSink.records().stream().anyMatch(record -> record.status() == 401
                && "gateway-401-test".equals(record.requestId())
                && "trace-401-test".equals(record.traceId())));
    }

    @Test
    void credentialedUnsafeRequestPrefersOriginAndRejectsConflictingReferer() {
        webTestClient.post()
                .uri("/api/v1/auth/token/refresh")
                .header(HttpHeaders.ORIGIN, LEARNER_ORIGIN)
                .header(HttpHeaders.REFERER, "https://untrusted.example.test/refresh")
                .cookie("yuxuexing_refresh", "opaque-refresh-cookie")
                .header("X-Request-Id", "gateway-403-test")
                .header("X-Trace-Id", "trace-403-test")
                .exchange()
                .expectStatus().isForbidden()
                .expectHeader().valueEquals("X-Request-Id", "gateway-403-test")
                .expectHeader().valueEquals("X-Trace-Id", "trace-403-test")
                .expectBody()
                .jsonPath("$.error.code").isEqualTo("forbidden");

        assertTrue(auditSink.records().stream().anyMatch(record -> record.status() == 403
                && "origin_referer_conflict".equals(record.reasonCode())
                && "gateway-403-test".equals(record.requestId())));
    }

    @Test
    void authClassRateLimitReturns429AndRetryAfter() {
        rateLimitBackend.mode = ControllableRateLimitBackend.Mode.DENY;

        webTestClient.get()
                .uri("/api/v1/public/content/catalog")
                .header("X-Request-Id", "gateway-429-test")
                .header("X-Trace-Id", "trace-429-test")
                .exchange()
                .expectStatus().isEqualTo(429)
                .expectHeader().valueEquals("X-RateLimit-Policy", "public-read")
                .expectHeader().exists("Retry-After")
                .expectHeader().valueEquals("X-Request-Id", "gateway-429-test")
                .expectBody()
                .jsonPath("$.error.code").isEqualTo("rate_limited");

        assertTrue(auditSink.records().stream().anyMatch(record -> record.status() == 429
                && "rate_limited".equals(record.reasonCode())));
    }

    @Test
    void unavailableRateLimitBackendFailsClosedWith503() {
        rateLimitBackend.mode = ControllableRateLimitBackend.Mode.FAIL;

        webTestClient.get()
                .uri("/api/v1/public/content/catalog")
                .header("X-Request-Id", "gateway-503-test")
                .header("X-Trace-Id", "trace-503-test")
                .exchange()
                .expectStatus().isEqualTo(503)
                .expectHeader().valueEquals("X-RateLimit-Backend", "unavailable")
                .expectHeader().valueEquals("X-Request-Id", "gateway-503-test")
                .expectBody()
                .jsonPath("$.error.code").isEqualTo("rate_limit_backend_unavailable");

        assertTrue(auditSink.records().stream().anyMatch(record -> record.status() == 503
                && "rate_limit_backend_unavailable".equals(record.reasonCode())));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class BoundaryTestConfiguration {

        @Bean
        @Primary
        ControllableRateLimitBackend controllableRateLimitBackend() {
            return new ControllableRateLimitBackend();
        }

        @Bean
        @Primary
        CapturingSecurityAuditSink capturingSecurityAuditSink() {
            return new CapturingSecurityAuditSink();
        }
    }

    static final class ControllableRateLimitBackend implements RateLimitBackend {
        enum Mode { ALLOW, DENY, FAIL }

        volatile Mode mode = Mode.ALLOW;

        @Override
        public Mono<RateLimitDecision> consume(String key, GatewayProperties.RateLimitPolicy policy) {
            long reset = Instant.now().plusSeconds(30).getEpochSecond();
            return switch (mode) {
                case ALLOW -> Mono.just(new RateLimitDecision(
                        true, policy.requestsPerWindow(), policy.requestsPerWindow() - 1L, reset));
                case DENY -> Mono.just(new RateLimitDecision(false, policy.requestsPerWindow(), 0, reset));
                case FAIL -> Mono.error(new IllegalStateException("test backend unavailable"));
            };
        }
    }

    static final class CapturingSecurityAuditSink implements SecurityAuditSink {
        private final CopyOnWriteArrayList<SecurityAuditRecord> records = new CopyOnWriteArrayList<>();

        @Override
        public void record(SecurityAuditRecord record) {
            records.add(record);
        }

        List<SecurityAuditRecord> records() {
            return List.copyOf(records);
        }

        void clear() {
            records.clear();
        }
    }
}
