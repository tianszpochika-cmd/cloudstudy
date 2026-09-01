package com.englishflow.gateway.config;

import com.englishflow.gateway.ApiGatewayApplication;
import com.englishflow.gateway.filter.ClientAuthorizationContextHeaders;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Uses the actual Gateway RouteLocator, JWT resource server and a local HTTP
 * upstream. It proves canonical no-match requests do not reach broad legacy
 * route predicates even when their JWT is valid.
 */
@SpringBootTest(
        classes = ApiGatewayApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "gateway.rate-limit.enabled=false",
                "gateway.rate-limit.backend=memory",
                "gateway.compatibility.enabled=false",
                "gateway.b12.enabled=false",
                "gateway.b13.enabled=false",
                "gateway.b14.enabled=true",
                "management.otlp.metrics.export.enabled=false",
                "management.tracing.export.enabled=false",
                "management.opentelemetry.enabled=false"
        }
)
@Import(CanonicalRoutePolicyRouteLocatorIntegrationTest.TestJwtDecoderConfiguration.class)
class CanonicalRoutePolicyRouteLocatorIntegrationTest {

    private static final String ISSUER = "https://iam.integration.test";
    private static final RSAKey SIGNING_KEY = signingKey();
    private static final StubServer STUB = StubServer.start(SIGNING_KEY);

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private RouteLocator routeLocator;

    @Autowired
    private ReactiveJwtDecoder jwtDecoder;

    private WebTestClient client;

    @DynamicPropertySource
    static void gatewayProperties(DynamicPropertyRegistry registry) {
        registry.add("gateway.security.resource-server-enabled", () -> "true");
        registry.add("gateway.security.jwt-prevalidation-enabled", () -> "true");
        registry.add("gateway.security.issuer-uri", () -> ISSUER);
        registry.add("gateway.security.jwk-set-uri", () -> STUB.baseUrl() + "/jwks");
        registry.add("gateway.identity.iam-base-url", STUB::baseUrl);
        registry.add("gateway.b14.service-base-urls.learning", STUB::baseUrl);
    }

    @BeforeEach
    void setUp() {
        STUB.resetUpstreamRequests();
        client = WebTestClient.bindToApplicationContext(applicationContext)
                .build();
    }

    @AfterAll
    static void stopStub() {
        STUB.stop();
    }

    @Test
    void validJwtCanonicalNoMatchesNeverReachBroadConfiguredRoutesOrUpstream() throws Exception {
        List<String> routeIds = routeLocator.getRoutes().map(route -> route.getId()).collectList().block();
        assertTrue(routeIds.contains("iam-auth"));
        assertTrue(routeIds.contains("b14-learning-target"));

        String token = validAccessToken();
        assertEquals("integration-subject", jwtDecoder.decode(token).block().getSubject());
        client.patch()
                .uri("/api/v1/learning/test")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody().jsonPath("$.error.code").isEqualTo("unknown_api_route");

        client.delete()
                .uri("/api/v1/auth/login")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody().jsonPath("$.error.code").isEqualTo("unknown_api_route");

        assertEquals(0, STUB.upstreamRequestCount());
    }

    @Test
    void configuredRouteFiltersRepeatGlobalAuthoritySanitization() {
        List<org.springframework.cloud.gateway.route.Route> routes = routeLocator.getRoutes().collectList().block();
        for (String routeId : List.of("iam-auth", "b14-learning-target")) {
            String filters = routes.stream()
                    .filter(route -> routeId.equals(route.getId()))
                    .findFirst()
                    .orElseThrow()
                    .getFilters()
                    .toString();
            for (String forbidden : ClientAuthorizationContextHeaders.NAMES) {
                assertTrue(filters.contains(forbidden), routeId + " must remove " + forbidden);
            }
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestJwtDecoderConfiguration {
        @Bean
        @Primary
        ReactiveJwtDecoder localValidatingJwtDecoder() {
            try {
                NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withPublicKey(SIGNING_KEY.toRSAPublicKey()).build();
                decoder.setJwtValidator(GatewayJwtValidators.forSecurity(new GatewayProperties.Security(
                        true, true, true, ISSUER, "yuxuexing-api", STUB.baseUrl() + "/jwks"
                )));
                return decoder;
            } catch (Exception failure) {
                throw new IllegalStateException("Unable to construct the local test JWT decoder", failure);
            }
        }
    }

    private static String validAccessToken() throws Exception {
        Instant now = Instant.now();
        SignedJWT token = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256)
                        .keyID(SIGNING_KEY.getKeyID())
                        .type(JOSEObjectType.JWT)
                        .build(),
                new JWTClaimsSet.Builder()
                        .issuer(ISSUER)
                        .subject("integration-subject")
                        .audience("yuxuexing-api")
                        .issueTime(java.util.Date.from(now.minusSeconds(5)))
                        .notBeforeTime(java.util.Date.from(now.minusSeconds(5)))
                        .expirationTime(java.util.Date.from(now.plusSeconds(300)))
                        .jwtID("integration-jti")
                        .claim("token_type", "access")
                        .claim("scope", "learning.write")
                        .build()
        );
        token.sign(new RSASSASigner(SIGNING_KEY.toPrivateKey()));
        return token.serialize();
    }

    private static RSAKey signingKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("gateway-integration-test-key").generate();
        } catch (Exception failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }

    private static final class StubServer {
        private final ServerSocket server;
        private final ExecutorService executor = Executors.newCachedThreadPool();
        private final AtomicBoolean accepting = new AtomicBoolean(true);
        private final String jwks;
        private final AtomicInteger upstreamRequests = new AtomicInteger();

        private StubServer(ServerSocket server, RSAKey signingKey) {
            this.server = server;
            this.jwks = "{\"keys\":[" + signingKey.toPublicJWK().toJSONString() + "]}";
        }

        static StubServer start(RSAKey signingKey) {
            try {
                ServerSocket server = new ServerSocket();
                server.bind(new InetSocketAddress("127.0.0.1", 0));
                StubServer stub = new StubServer(server, signingKey);
                stub.acceptConnections();
                return stub;
            } catch (IOException failure) {
                throw new ExceptionInInitializerError(failure);
            }
        }

        String baseUrl() {
            return "http://127.0.0.1:" + server.getLocalPort();
        }

        void resetUpstreamRequests() {
            upstreamRequests.set(0);
        }

        int upstreamRequestCount() {
            return upstreamRequests.get();
        }

        void stop() {
            accepting.set(false);
            try {
                server.close();
            } catch (IOException ignored) {
                // Test fixture teardown only.
            }
            executor.shutdownNow();
        }

        private void acceptConnections() {
            executor.execute(() -> {
                while (accepting.get()) {
                    try {
                        Socket socket = server.accept();
                        executor.execute(() -> handle(socket));
                    } catch (IOException ignored) {
                        if (accepting.get()) {
                            throw new IllegalStateException("Gateway stub could not accept a local connection", ignored);
                        }
                    }
                }
            });
        }

        private void handle(Socket socket) {
            try (socket; InputStream input = new BufferedInputStream(socket.getInputStream());
                 OutputStream output = socket.getOutputStream()) {
                String path = readRequestPath(input);
                if (path == null) {
                    return;
                }
                if ("/jwks".equals(path)) {
                    respond(output, jwks);
                    return;
                }
                upstreamRequests.incrementAndGet();
                respond(output, "{}");
            } catch (IOException ignored) {
                // A closed test client must not make the stub fail the Gateway test.
            }
        }

        private static String readRequestPath(InputStream input) throws IOException {
            String requestLine = readLine(input);
            if (requestLine == null || requestLine.isBlank()) {
                return null;
            }
            String[] parts = requestLine.split(" ", 3);
            if (parts.length < 2) {
                return null;
            }
            String path = parts[1].split("\\?", 2)[0];
            for (String line; (line = readLine(input)) != null && !line.isEmpty(); ) {
            }
            return path;
        }

        private static String readLine(InputStream input) throws IOException {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            for (int value; (value = input.read()) != -1; ) {
                if (value == '\n') {
                    break;
                }
                if (value != '\r') {
                    bytes.write(value);
                }
            }
            return bytes.size() == 0 ? null : bytes.toString(StandardCharsets.US_ASCII);
        }

        private static void respond(OutputStream output, String body) throws IOException {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            String response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                    + bytes.length + "\r\nConnection: close\r\n\r\n";
            output.write(response.getBytes(StandardCharsets.US_ASCII));
            output.write(bytes);
            output.flush();
        }
    }
}
