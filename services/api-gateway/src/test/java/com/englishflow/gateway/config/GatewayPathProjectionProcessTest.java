package com.englishflow.gateway.config;

import com.englishflow.gateway.ApiGatewayApplication;
import com.englishflow.gateway.policy.GatewayRouteExecutionPolicy;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
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
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Sends real HTTP requests from the Gateway's RouteLocator to a loopback
 * upstream process. This proves that the one execution projection applies the
 * exact public-to-internal target path rather than merely exposing metadata.
 */
@SpringBootTest(
        classes = ApiGatewayApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "gateway.security.resource-server-enabled=true",
                "gateway.security.jwt-prevalidation-enabled=true",
                "gateway.security.audit-enabled=true",
                "gateway.rate-limit.enabled=false",
                "gateway.rate-limit.backend=memory",
                "gateway.compatibility.enabled=false",
                "gateway.identity.enabled=true",
                "gateway.b12.enabled=true",
                "gateway.b13.enabled=true",
                "gateway.workflow.enabled=true",
                "gateway.b14.enabled=true",
                "management.otlp.metrics.export.enabled=false",
                "management.tracing.export.enabled=false",
                "management.opentelemetry.enabled=false"
        }
)
@Import(GatewayPathProjectionProcessTest.LocalJwtDecoderConfiguration.class)
class GatewayPathProjectionProcessTest {

    private static final String ISSUER = "https://iam.path-projection.test";
    private static final RSAKey SIGNING_KEY = signingKey();
    private static final CapturingUpstream UPSTREAM = CapturingUpstream.start();

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private GatewayRoutePolicy routePolicy;

    @Autowired
    private GatewayRouteExecutionPolicy routeExecutionPolicy;

    private WebTestClient client;
    private String token;

    @DynamicPropertySource
    static void targetProperties(DynamicPropertyRegistry registry) {
        String upstream = UPSTREAM.baseUrl();
        registry.add("gateway.security.issuer-uri", () -> ISSUER);
        registry.add("gateway.security.audience", () -> "yuxuexing-api");
        registry.add("gateway.security.jwk-set-uri", () -> upstream + "/jwks-not-used");
        registry.add("gateway.identity.iam-base-url", () -> upstream);
        for (String domain : GatewayProperties.B14Services.DOMAINS) {
            registry.add("gateway.b14.service-base-urls." + domain, () -> upstream);
            registry.add("gateway.b14.route-modes." + domain, () -> "TARGET");
        }
        registry.add("gateway.b12.gamification-base-url", () -> upstream);
        registry.add("gateway.b12.social-base-url", () -> upstream);
        registry.add("gateway.b12.notification-base-url", () -> upstream);
        registry.add("gateway.b13.commerce-base-url", () -> upstream);
        registry.add("gateway.b13.admin-ops-base-url", () -> upstream);
        registry.add("gateway.b13.analytics-base-url", () -> upstream);
    }

    @BeforeEach
    void setUp() throws Exception {
        client = WebTestClient.bindToApplicationContext(applicationContext)
                .configureClient()
                .responseTimeout(Duration.ofSeconds(5))
                .build();
        token = validAccessToken();
        UPSTREAM.clear();
    }

    @AfterAll
    static void stopUpstream() {
        UPSTREAM.close();
    }

    @Test
    void exactRouteBindingsForwardCurrentOwnerInternalPathsToARealUpstreamProcess() throws Exception {
        assertForwarded(HttpMethod.POST,
                "/api/v1/assessment/sessions",
                "/internal/v1/assessment/sessions");
        assertForwarded(HttpMethod.POST,
                "/api/v1/assessment/placement/sessions",
                "/internal/v1/assessment/placement/sessions");
        assertForwarded(HttpMethod.GET,
                "/api/v1/assessment/placement/sessions/asess_12345678",
                "/internal/v1/assessment/placement/sessions/asess_12345678");
        assertForwarded(HttpMethod.POST,
                "/api/v1/assessment/placement/sessions/asess_12345678/responses",
                "/internal/v1/assessment/placement/sessions/asess_12345678/responses");
        assertForwarded(HttpMethod.POST,
                "/api/v1/assessment/placement/baselines/skip",
                "/internal/v1/assessment/placement/baselines/skip");
        assertForwarded(HttpMethod.GET,
                "/api/v1/assessment/placement/reports/rpt_12345678",
                "/internal/v1/assessment/placement/reports/rpt_12345678");
        assertForwarded(HttpMethod.GET,
                "/api/v1/mastery/overview",
                "/internal/v1/learning/experiences/mastery/overview");
        assertForwarded(HttpMethod.GET,
                "/api/v1/content/learner/vocabulary/vocab-42",
                "/internal/v1/content/learner/vocabulary/vocab-42");
        assertForwarded(HttpMethod.GET,
                "/api/v1/onboarding/options",
                "/internal/v1/learner/onboarding/options");
        assertForwarded(HttpMethod.GET,
                "/api/v1/admin/ops/commerce/orders",
                "/internal/v1/admin-ops/commerce/orders");
        assertForwarded(HttpMethod.GET,
                "/api/v1/notifications/preferences",
                "/internal/v1/notifications/preferences");
        assertForwarded(HttpMethod.GET,
                "/api/v1/admin/ops/metrics",
                "/internal/v1/analytics/metrics");
        assertForwarded(HttpMethod.GET,
                "/api/v1/admin/moderation/reports",
                "/internal/v1/social/admin/moderation/reports");
    }

    @Test
    void grammarPointsReadRewritesToContentOwnerAndPreservesCanonicalPaginationParameters() {
        client.get()
                .uri("/api/v1/grammar/points?cursor=MzEwMQ&pageSize=20&cefrLevel=B1")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("X-Request-Id", "grammar-points-route-test")
                .exchange()
                .expectStatus().isOk();

        CapturedRequest received = UPSTREAM.next();
        assertNotNull(received);
        assertEquals("GET", received.method());
        assertEquals("/internal/v1/content/learner/grammar/points", received.path());
        assertEquals("cursor=MzEwMQ&pageSize=20&cefrLevel=B1", received.query());
        assertEquals("canonical-grammar-points-read-list", received.routeId());
    }

    @Test
    void moderationFiltersAndOpaqueCursorSurviveTheOwnerPathRewrite() {
        client.get()
                .uri("/api/v1/admin/moderation/reports?status=REVIEWING&pageSize=7&cursor=opaque_12345678")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("X-Request-Id", "projection-process-request")
                .exchange()
                .expectStatus().isOk();
        CapturedRequest received = UPSTREAM.next();
        assertNotNull(received);
        assertEquals("/internal/v1/social/admin/moderation/reports", received.path());
        assertEquals("status=REVIEWING&pageSize=7&cursor=opaque_12345678", received.query());
    }

    private void assertForwarded(HttpMethod method, String publicPath, String expectedTargetPath) {
        var response = client.method(method)
                .uri(publicPath)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("X-Request-Id", "projection-process-request")
                .header("X-Trace-Id", "projection-process-trace")
                .exchange()
                .expectBody()
                .returnResult();

        CapturedRequest received = UPSTREAM.next();
        assertNotNull(received, "Gateway did not reach a real upstream process for " + publicPath);
        assertEquals(method.name(), received.method(), publicPath + " upstream method");
        assertEquals(expectedTargetPath, received.path(), publicPath + " exact rewritten upstream path");
        GatewayRoutePolicy.Resolution resolution = routePolicy.resolve(method, publicPath);
        String expectedRouteId = routeExecutionPolicy.routeBindings().stream()
                .filter(binding -> binding.rule().equals(resolution.rule()))
                .filter(binding -> binding.pathProjection().accepts(method, publicPath))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No exact route binding for " + publicPath))
                .routeId();
        assertEquals(expectedRouteId, received.routeId(), publicPath + " generated canonical route id");
        assertEquals(200, response.getStatus().value(), publicPath + " Gateway response status");
        assertEquals("projection-process-request", response.getResponseHeaders().getFirst("X-Request-Id"));
        assertEquals("projection-process-trace", response.getResponseHeaders().getFirst("X-Trace-Id"));
        assertEquals(1, response.getResponseHeaders().get("X-Request-Id").size(),
                publicPath + " request correlation response header must remain single-valued");
        assertEquals(1, response.getResponseHeaders().get("X-Trace-Id").size(),
                publicPath + " trace correlation response header must remain single-valued");
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class LocalJwtDecoderConfiguration {
        @Bean
        @Primary
        ReactiveJwtDecoder localValidatingJwtDecoder() {
            try {
                NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withPublicKey(SIGNING_KEY.toRSAPublicKey()).build();
                decoder.setJwtValidator(GatewayJwtValidators.forSecurity(new GatewayProperties.Security(
                        true, true, true, ISSUER, "yuxuexing-api", UPSTREAM.baseUrl() + "/jwks-not-used"
                )));
                return decoder;
            } catch (Exception failure) {
                throw new IllegalStateException("Unable to construct local path-projection decoder", failure);
            }
        }

        /**
         * The desktop JDK's non-blocking selector cannot create loopback
         * transport channels. Keep the real TCP mock process but substitute
         * only the terminal test transport after Gateway has applied its route
         * predicates, metadata and RewritePath filter. Production continues to
         * use NettyRoutingFilter.
         */
        @Bean
        GlobalFilter loopbackUpstreamTransport() {
            return new LoopbackUpstreamTransport();
        }
    }

    private static final class LoopbackUpstreamTransport implements GlobalFilter, Ordered {
        @Override
        public int getOrder() {
            return Ordered.LOWEST_PRECEDENCE - 2;
        }

        @Override
        public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
            URI target = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR);
            if (target == null || !"127.0.0.1".equals(target.getHost()) || target.getPort() != UPSTREAM.serverPort()) {
                return chain.filter(exchange);
            }
            String routeId = exchange.getRequest().getHeaders().getFirst("X-Gateway-Route");
            return Mono.fromCallable(() -> UPSTREAM.request(target, exchange.getRequest().getMethod(), routeId))
                    .subscribeOn(Schedulers.boundedElastic())
                    .flatMap(result -> {
                        exchange.getResponse().setStatusCode(HttpStatusCode.valueOf(result.status()));
                        exchange.getResponse().getHeaders().set(HttpHeaders.CONTENT_TYPE, "application/json");
                        // Model an owner that echoes the propagated correlation
                        // headers, as IAM does in the real cross-process path.
                        exchange.getResponse().getHeaders().add("X-Request-Id",
                                exchange.getRequest().getHeaders().getFirst("X-Request-Id"));
                        exchange.getResponse().getHeaders().add("X-Trace-Id",
                                exchange.getRequest().getHeaders().getFirst("X-Trace-Id"));
                        DataBuffer body = exchange.getResponse().bufferFactory().wrap(result.body());
                        return exchange.getResponse().writeWith(Mono.just(body));
                    });
        }
    }

    private static String validAccessToken() throws Exception {
        Instant now = Instant.now();
        SignedJWT signed = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256)
                        .keyID(SIGNING_KEY.getKeyID())
                        .type(JOSEObjectType.JWT)
                        .build(),
                new JWTClaimsSet.Builder()
                        .issuer(ISSUER)
                        .subject("gateway-path-projection-subject")
                        .audience("yuxuexing-api")
                        .issueTime(Date.from(now.minusSeconds(5)))
                        .notBeforeTime(Date.from(now.minusSeconds(5)))
                        .expirationTime(Date.from(now.plusSeconds(300)))
                        .jwtID("gateway-path-projection-jti")
                        .claim("token_type", "access")
                        .claim("scope", "learning.write")
                        .build()
        );
        signed.sign(new RSASSASigner(SIGNING_KEY.toPrivateKey()));
        return signed.serialize();
    }

    private static RSAKey signingKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("gateway-path-projection-key").generate();
        } catch (Exception failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }

    private record CapturedRequest(String method, String path, String query, String routeId) {
    }

    private static final class CapturingUpstream implements AutoCloseable {
        private final ServerSocket server;
        private final BlockingQueue<CapturedRequest> requests = new LinkedBlockingQueue<>();
        private final Thread acceptThread;

        private CapturingUpstream(ServerSocket server) {
            this.server = server;
            this.acceptThread = new Thread(this::acceptRequests, "gateway-path-projection-upstream");
            this.acceptThread.setDaemon(true);
            this.acceptThread.start();
        }

        static CapturingUpstream start() {
            try {
                ServerSocket server = new ServerSocket();
                server.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0));
                return new CapturingUpstream(server);
            } catch (IOException failure) {
                throw new ExceptionInInitializerError(failure);
            }
        }

        String baseUrl() {
            return "http://127.0.0.1:" + server.getLocalPort();
        }

        int serverPort() {
            return server.getLocalPort();
        }

        void clear() {
            requests.clear();
        }

        CapturedRequest next() {
            try {
                return requests.poll(5, TimeUnit.SECONDS);
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                throw new AssertionError("Interrupted while waiting for upstream request", failure);
            }
        }

        UpstreamResponse request(URI target, HttpMethod method, String routeId) throws IOException {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(target.getHost(), target.getPort()), 2_000);
                socket.setSoTimeout(2_000);
                String targetPath = target.getRawPath() == null || target.getRawPath().isBlank() ? "/" : target.getRawPath();
                if (target.getRawQuery() != null && !target.getRawQuery().isBlank()) {
                    targetPath += "?" + target.getRawQuery();
                }
                OutputStream output = socket.getOutputStream();
                output.write((method.name() + " " + targetPath + " HTTP/1.1\r\n"
                        + "Host: " + target.getHost() + "\r\n"
                        + "X-Gateway-Route: " + routeId + "\r\n"
                        + "Content-Length: 0\r\n"
                        + "Connection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                output.flush();

                InputStream input = new BufferedInputStream(socket.getInputStream());
                String statusLine = readLine(input);
                if (statusLine == null) {
                    throw new IOException("Mock upstream closed before its HTTP status line");
                }
                String[] statusParts = statusLine.split(" ", 3);
                if (statusParts.length < 2) {
                    throw new IOException("Invalid mock upstream HTTP status line: " + statusLine);
                }
                int contentLength = 0;
                String header;
                while ((header = readLine(input)) != null && !header.isEmpty()) {
                    int delimiter = header.indexOf(':');
                    if (delimiter > 0 && "Content-Length".equalsIgnoreCase(header.substring(0, delimiter).trim())) {
                        contentLength = Integer.parseInt(header.substring(delimiter + 1).trim());
                    }
                }
                byte[] body = input.readNBytes(contentLength);
                return new UpstreamResponse(Integer.parseInt(statusParts[1]), body);
            }
        }

        private void acceptRequests() {
            while (!server.isClosed()) {
                try (Socket socket = server.accept()) {
                    socket.setSoTimeout((int) Duration.ofSeconds(2).toMillis());
                    captureConnection(socket);
                } catch (SocketException ignored) {
                    if (!server.isClosed()) {
                        throw new AssertionError("Gateway test upstream socket failed", ignored);
                    }
                } catch (IOException failure) {
                    if (!server.isClosed()) {
                        throw new AssertionError("Gateway test upstream process failed", failure);
                    }
                }
            }
        }

        private void captureConnection(Socket socket) throws IOException {
            InputStream input = new BufferedInputStream(socket.getInputStream());
            OutputStream output = socket.getOutputStream();
            while (!socket.isClosed()) {
                String requestLine = readLine(input);
                if (requestLine == null || requestLine.isBlank()) {
                    return;
                }
                String routeId = null;
                int contentLength = 0;
                String header;
                while ((header = readLine(input)) != null && !header.isEmpty()) {
                    int delimiter = header.indexOf(':');
                    if (delimiter < 0) {
                        continue;
                    }
                    String name = header.substring(0, delimiter).trim();
                    String value = header.substring(delimiter + 1).trim();
                    if ("X-Gateway-Route".equalsIgnoreCase(name)) {
                        routeId = value;
                    }
                    if ("Content-Length".equalsIgnoreCase(name)) {
                        contentLength = Integer.parseInt(value);
                    }
                }
                consume(input, contentLength);
                String[] parts = requestLine.split(" ", 3);
                if (parts.length < 2) {
                    throw new IOException("Invalid upstream request line: " + requestLine);
                }
                int queryStart = parts[1].indexOf('?');
                String path = queryStart < 0 ? parts[1] : parts[1].substring(0, queryStart);
                String query = queryStart < 0 ? null : parts[1].substring(queryStart + 1);
                requests.add(new CapturedRequest(parts[0], path, query, routeId));
                byte[] response = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
                output.write(("HTTP/1.1 200 OK\r\n"
                        + "Content-Type: application/json\r\n"
                        + "Content-Length: " + response.length + "\r\n"
                        + "Connection: keep-alive\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                output.write(response);
                output.flush();
            }
        }

        private static String readLine(InputStream input) throws IOException {
            StringBuilder line = new StringBuilder();
            int next;
            while ((next = input.read()) >= 0) {
                if (next == '\n') {
                    return line.toString();
                }
                if (next != '\r') {
                    line.append((char) next);
                }
                if (line.length() > 16 * 1024) {
                    throw new IOException("Gateway test upstream request header is too large");
                }
            }
            return line.isEmpty() ? null : line.toString();
        }

        private static void consume(InputStream input, int bytes) throws IOException {
            for (int remaining = bytes; remaining > 0; ) {
                long skipped = input.skip(remaining);
                if (skipped <= 0) {
                    if (input.read() < 0) {
                        throw new IOException("Unexpected EOF in upstream request body");
                    }
                    skipped = 1;
                }
                remaining -= (int) skipped;
            }
        }

        @Override
        public void close() {
            try {
                server.close();
                acceptThread.join(Duration.ofSeconds(5));
            } catch (IOException failure) {
                throw new AssertionError("Unable to stop Gateway test upstream process", failure);
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                throw new AssertionError("Interrupted while stopping Gateway test upstream process", failure);
            }
        }
    }

    private record UpstreamResponse(int status, byte[] body) {
    }
}
