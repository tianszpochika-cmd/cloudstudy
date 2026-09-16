package com.englishflow.gateway;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Reproduces the real P1R-M2-001 cross-process defect: IAM publishes
 * {@code /api/v1/auth/jwks} as an {@code ApiSuccessEnvelope}
 * ({@code {"data":{"keys":[...]},"meta":{...}}}), while the stock
 * {@code NimbusReactiveJwtDecoder.withJwkSetUri} parser only accepts a bare
 * RFC 7517 JWK Set. Before the fix every correctly signed token was rejected
 * with a redacted 401 because the envelope failed {@code JWKSet.parse}.
 *
 * <p>The stub deliberately serves the exact documented envelope over real HTTP
 * and the assertions run against the production decoder, not a mock.
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
                "gateway.workflow.enabled=false",
                // The learner route must exist so the test exercises resource
                // server authentication rather than canonical no-route denial.
                "gateway.b14.enabled=true",
                "management.otlp.metrics.export.enabled=false",
                "management.tracing.export.enabled=false"
        }
)
class GatewayEnvelopedJwksAuthenticationProcessTest {

    private static final String ISSUER = "https://iam.enveloped-jwks.test";
    private static final String KID = "iam-enveloped-jwks-kid";
    private static final String PROTECTED_PATH = "/api/v1/learner/profile";
    private static final RSAKey SIGNING_KEY = signingKey();
    private static final RSAKey UNPUBLISHED_KEY = unpublishedKey();
    private static final AtomicInteger JWKS_READS = new AtomicInteger();
    private static final List<String> FORWARDED_AUTHORIZATION = new CopyOnWriteArrayList<>();
    private static final HttpServer UPSTREAM = startUpstreamStub();

    @Autowired
    private ApplicationContext applicationContext;

    private WebTestClient client;

    @DynamicPropertySource
    static void envelopedJwksProperties(DynamicPropertyRegistry registry) {
        String origin = "http://127.0.0.1:" + UPSTREAM.getAddress().getPort();
        registry.add("gateway.security.issuer-uri", () -> ISSUER);
        registry.add("gateway.security.jwk-set-uri", () -> origin + "/api/v1/auth/jwks");
        registry.add("gateway.b14.service-base-urls.learner", () -> origin);
    }

    @BeforeEach
    void setUp() {
        client = WebTestClient.bindToApplicationContext(applicationContext)
                .configureClient()
                .responseTimeout(Duration.ofSeconds(5))
                .build();
        FORWARDED_AUTHORIZATION.clear();
    }

    @AfterAll
    static void stopUpstreamStub() {
        UPSTREAM.stop(0);
    }

    @Test
    void tokenSignedByTheEnvelopedPublishedKeyReachesTheOwnerRoute() throws Exception {
        String token = accessToken(SIGNING_KEY);

        client.get()
                .uri(PROTECTED_PATH)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .exchange()
                .expectStatus().isOk();

        assertTrue(JWKS_READS.get() >= 1, "the Gateway must read the published JWKS over HTTP");
        assertEquals(1, FORWARDED_AUTHORIZATION.size());
        assertTrue(FORWARDED_AUTHORIZATION.getFirst().startsWith("Bearer "));
    }

    @Test
    void theSameRouteStillRejectsARequestWithoutAToken() {
        client.get()
                .uri(PROTECTED_PATH)
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
    }

    @Test
    void aTokenSignedByAnUnpublishedKeyStaysUnauthorized() throws Exception {
        client.get()
                .uri(PROTECTED_PATH)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(UNPUBLISHED_KEY))
                .exchange()
                .expectStatus().isUnauthorized();
    }

    private static String accessToken(RSAKey signingKey) throws Exception {
        Instant now = Instant.now();
        SignedJWT token = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256)
                        .keyID(KID)
                        .type(JOSEObjectType.JWT)
                        .build(),
                new JWTClaimsSet.Builder()
                        .issuer(ISSUER)
                        .subject("enveloped-jwks-subject")
                        .audience("yuxuexing-api")
                        .issueTime(Date.from(now.minusSeconds(5)))
                        .notBeforeTime(Date.from(now.minusSeconds(5)))
                        .expirationTime(Date.from(now.plusSeconds(300)))
                        .jwtID("enveloped-jwks-jti")
                        .claim("token_type", "access")
                        .claim("scope", "learner.profile.read")
                        .build()
        );
        token.sign(new RSASSASigner(signingKey.toPrivateKey()));
        return token.serialize();
    }

    private static HttpServer startUpstreamStub() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.setExecutor(Executors.newFixedThreadPool(4));
            server.createContext("/api/v1/auth/jwks", exchange -> {
                JWKS_READS.incrementAndGet();
                // The exact frozen IAM envelope; a bare key set would hide the defect.
                respond(exchange, 200, "{\"data\":" + new JWKSet(SIGNING_KEY.toPublicJWK())
                        + ",\"meta\":{\"requestId\":\"enveloped-jwks\"}}");
            });
            server.createContext("/", exchange -> {
                String authorization = exchange.getRequestHeaders().getFirst("Authorization");
                if (authorization != null) {
                    FORWARDED_AUTHORIZATION.add(authorization);
                }
                respond(exchange, 200, "{\"data\":{\"surface\":\"owner-route\"},\"meta\":{}}");
            });
            server.start();
            return server;
        } catch (IOException failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] payload = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, payload.length);
        try (OutputStream stream = exchange.getResponseBody()) {
            stream.write(payload);
        }
    }

    private static RSAKey signingKey() {
        try {
            return new RSAKeyGenerator(2048).keyID(KID).generate();
        } catch (Exception failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }

    private static RSAKey unpublishedKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("unpublished-kid").generate();
        } catch (Exception failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }
}
