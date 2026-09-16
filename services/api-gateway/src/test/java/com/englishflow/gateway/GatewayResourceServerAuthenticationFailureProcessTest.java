package com.englishflow.gateway;

import com.englishflow.gateway.support.SecurityAuditRecord;
import com.englishflow.gateway.support.SecurityAuditSink;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises Resource Server authentication before the Gateway route pipeline.
 * These checks deliberately use MOCK WebFlux, not an external IAM/JWKS runtime.
 */
@SpringBootTest(
        classes = ApiGatewayApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "gateway.security.resource-server-enabled=true",
                "gateway.security.jwt-prevalidation-enabled=true",
                "gateway.security.audit-enabled=true",
                "gateway.security.issuer-uri=https://iam.authentication-test.invalid",
                "gateway.security.audience=yuxuexing-api",
                "gateway.security.jwk-set-uri=https://iam.authentication-test.invalid/api/v1/auth/jwks",
                "gateway.rate-limit.enabled=false",
                "gateway.rate-limit.backend=memory",
                "gateway.compatibility.enabled=false",
                "gateway.identity.enabled=false",
                "gateway.b12.enabled=false",
                "gateway.b13.enabled=false",
                "gateway.workflow.enabled=false",
                // Keep the canonical learner route present. Authentication must
                // fail before any upstream target can be reached.
                "gateway.b14.enabled=true",
                "management.otlp.metrics.export.enabled=false",
                "management.tracing.export.enabled=false"
        }
)
@Import(GatewayResourceServerAuthenticationFailureProcessTest.AuthenticationFailureTestConfiguration.class)
class GatewayResourceServerAuthenticationFailureProcessTest {

    private static final String DECODER_FAILURE_TOKEN = "decoder-failure-token";
    private static final String DECODER_DIAGNOSTIC = "decoder-detail-must-never-leak";
    private static final RSAKey TEST_KEY = signingKey();

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private CapturingSecurityAuditSink auditSink;

    private WebTestClient client;

    @BeforeEach
    void setUp() {
        client = WebTestClient.bindToApplicationContext(applicationContext)
                .configureClient()
                .baseUrl("http://127.0.0.1:18070")
                .build();
        auditSink.clear();
    }

    @Test
    void malformedBearerTokenGetsCanonical401WithCorrelationAndNoDecoderDetail() {
        String body = client.get()
                .uri("/api/v1/learner/profile")
                .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt")
                .header("X-Request-Id", "bad-token-request")
                .header("X-Trace-Id", "bad-token-trace")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
                .expectHeader().valueEquals("X-Request-Id", "bad-token-request")
                .expectHeader().valueEquals("X-Trace-Id", "bad-token-trace")
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        assertTrue(body.contains("\"errorCode\":\"AUTH_REQUIRED\""));
        assertFalse(body.contains("not-a-jwt"));
        assertCanonicalAudit("bad-token-request", "bad-token-trace", "not-a-jwt");
    }

    @Test
    void malformedBearerMatchesMissingTokenEnvelopeAndEachFailureWritesOneAuditRecord() {
        String missingBody = client.get()
                .uri("/api/v1/learner/profile")
                .header("X-Request-Id", "paired-auth-request")
                .header("X-Trace-Id", "paired-auth-trace")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
                .expectHeader().valueEquals("X-Request-Id", "paired-auth-request")
                .expectHeader().valueEquals("X-Trace-Id", "paired-auth-trace")
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertCanonicalAudit("paired-auth-request", "paired-auth-trace", "not-a-jwt");

        auditSink.clear();
        String malformedBody = client.get()
                .uri("/api/v1/learner/profile")
                .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt")
                .header("X-Request-Id", "paired-auth-request")
                .header("X-Trace-Id", "paired-auth-trace")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
                .expectHeader().valueEquals("X-Request-Id", "paired-auth-request")
                .expectHeader().valueEquals("X-Trace-Id", "paired-auth-trace")
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertCanonicalAudit("paired-auth-request", "paired-auth-trace", "not-a-jwt");

        // `serverTime` is deliberately generated per response; all stable
        // canonical envelope fields must remain indistinguishable.
        assertEquals(withoutServerTime(missingBody), withoutServerTime(malformedBody));
    }

    @Test
    void decoderFailureIsAlsoRedactedToCanonical401() {
        String body = client.get()
                .uri("/api/v1/learner/profile")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + DECODER_FAILURE_TOKEN)
                .header("X-Request-Id", "decoder-failure-request")
                .header("X-Trace-Id", "decoder-failure-trace")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
                .expectHeader().valueEquals("X-Request-Id", "decoder-failure-request")
                .expectHeader().valueEquals("X-Trace-Id", "decoder-failure-trace")
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        assertTrue(body.contains("\"errorCode\":\"AUTH_REQUIRED\""));
        assertFalse(body.contains(DECODER_FAILURE_TOKEN));
        assertFalse(body.contains(DECODER_DIAGNOSTIC));
        assertCanonicalAudit("decoder-failure-request", "decoder-failure-trace", DECODER_DIAGNOSTIC);
    }

    private void assertCanonicalAudit(String requestId, String traceId, String forbiddenDetail) {
        assertEquals(1, auditSink.records().size(), "one authentication failure must yield one audit record");
        assertTrue(auditSink.records().stream().anyMatch(record -> record.status() == 401
                && "unauthorized".equals(record.reasonCode())
                && requestId.equals(record.requestId())
                && traceId.equals(record.traceId())));
        assertFalse(auditSink.records().stream().anyMatch(record -> record.reasonCode().contains(forbiddenDetail)
                || record.routeId().contains(forbiddenDetail)
                || record.requestId().contains(forbiddenDetail)
                || record.traceId().contains(forbiddenDetail)));
    }

    private static String withoutServerTime(String body) {
        return body.replaceAll("\\\"serverTime\\\":\\\"[^\\\"]+\\\"", "\"serverTime\":\"<generated>\"");
    }

    private static RSAKey signingKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("authentication-failure-test-key").generate();
        } catch (Exception failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class AuthenticationFailureTestConfiguration {

        @Bean
        @Primary
        ReactiveJwtDecoder resourceServerDecoder() {
            try {
                NimbusReactiveJwtDecoder nimbus = NimbusReactiveJwtDecoder.withPublicKey(TEST_KEY.toRSAPublicKey()).build();
                return token -> DECODER_FAILURE_TOKEN.equals(token)
                        ? Mono.error(new JwtException(DECODER_DIAGNOSTIC + ": " + token))
                        : nimbus.decode(token);
            } catch (Exception failure) {
                throw new IllegalStateException("Unable to construct local Resource Server decoder", failure);
            }
        }

        @Bean
        @Primary
        CapturingSecurityAuditSink capturingSecurityAuditSink() {
            return new CapturingSecurityAuditSink();
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
