package com.englishflow.gateway;

import com.englishflow.gateway.support.SecurityAuditRecord;
import com.englishflow.gateway.support.SecurityAuditSink;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises the production NimbusReactiveJwtDecoder with an unknown key ID and
 * a locally unreachable JWKS endpoint. It must not rely on a mocked decoder.
 */
@SpringBootTest(
        classes = ApiGatewayApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "gateway.security.resource-server-enabled=true",
                "gateway.security.jwt-prevalidation-enabled=true",
                "gateway.security.audit-enabled=true",
                "gateway.security.audience=yuxuexing-api",
                "gateway.rate-limit.enabled=false",
                "gateway.rate-limit.backend=memory",
                "gateway.compatibility.enabled=false",
                "gateway.identity.enabled=false",
                "gateway.b12.enabled=false",
                "gateway.b13.enabled=false",
                // The learner route must exist so the test exercises resource
                // server authentication rather than canonical no-route denial.
                "gateway.b14.enabled=true",
                "management.otlp.metrics.export.enabled=false",
                "management.tracing.export.enabled=false"
        }
)
@Import(GatewayUnreachableJwksAuthenticationFailureProcessTest.UnreachableJwksTestConfiguration.class)
class GatewayUnreachableJwksAuthenticationFailureProcessTest {

    private static final String ISSUER = "https://iam.unreachable-jwks.test";
    private static final String UNKNOWN_KID = "unknown-kid-unreachable-jwks";
    private static final int UNREACHABLE_JWKS_PORT = reserveClosedLoopbackPort();
    private static final RSAKey SIGNING_KEY = signingKey();

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private CapturingSecurityAuditSink auditSink;

    private WebTestClient client;

    @DynamicPropertySource
    static void remoteJwksProperties(DynamicPropertyRegistry registry) {
        registry.add("gateway.security.issuer-uri", () -> ISSUER);
        registry.add("gateway.security.jwk-set-uri",
                () -> "http://127.0.0.1:" + UNREACHABLE_JWKS_PORT + "/api/v1/auth/jwks");
    }

    @BeforeEach
    void setUp() {
        client = WebTestClient.bindToApplicationContext(applicationContext)
                .configureClient()
                .responseTimeout(Duration.ofSeconds(5))
                .build();
        auditSink.clear();
    }

    @Test
    void unknownKidWithUnreachableRealJwksUsesCanonical401AndOneRedactedAudit() throws Exception {
        String token = signedUnknownKidToken();
        String body = client.get()
                .uri("/api/v1/learner/profile")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("X-Request-Id", "unreachable-jwks-request")
                .header("X-Trace-Id", "unreachable-jwks-trace")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
                .expectHeader().valueEquals("X-Request-Id", "unreachable-jwks-request")
                .expectHeader().valueEquals("X-Trace-Id", "unreachable-jwks-trace")
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        assertTrue(body.contains("\"errorCode\":\"AUTH_REQUIRED\""));
        assertFalse(body.contains(UNKNOWN_KID));
        assertFalse(body.contains("Could not obtain the keys"));
        assertFalse(body.contains("127.0.0.1:" + UNREACHABLE_JWKS_PORT));

        List<SecurityAuditRecord> records = auditSink.records();
        assertEquals(1, records.size());
        SecurityAuditRecord record = records.getFirst();
        assertEquals(401, record.status());
        assertEquals("unauthorized", record.reasonCode());
        assertEquals("unreachable-jwks-request", record.requestId());
        assertEquals("unreachable-jwks-trace", record.traceId());
        assertFalse(record.reasonCode().contains(UNKNOWN_KID));
    }

    private static String signedUnknownKidToken() throws Exception {
        Instant now = Instant.now();
        SignedJWT token = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256)
                        .keyID(UNKNOWN_KID)
                        .type(JOSEObjectType.JWT)
                        .build(),
                new JWTClaimsSet.Builder()
                        .issuer(ISSUER)
                        .subject("unreachable-jwks-subject")
                        .audience("yuxuexing-api")
                        .issueTime(java.util.Date.from(now.minusSeconds(5)))
                        .notBeforeTime(java.util.Date.from(now.minusSeconds(5)))
                        .expirationTime(java.util.Date.from(now.plusSeconds(300)))
                        .jwtID("unreachable-jwks-jti")
                        .claim("token_type", "access")
                        .claim("scope", "learning.read")
                        .build()
        );
        token.sign(new RSASSASigner(SIGNING_KEY.toPrivateKey()));
        return token.serialize();
    }

    private static int reserveClosedLoopbackPort() {
        try (ServerSocket socket = new ServerSocket()) {
            socket.bind(new InetSocketAddress("127.0.0.1", 0));
            return socket.getLocalPort();
        } catch (Exception failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }

    private static RSAKey signingKey() {
        try {
            return new RSAKeyGenerator(2048).keyID(UNKNOWN_KID).generate();
        } catch (Exception failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class UnreachableJwksTestConfiguration {

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
