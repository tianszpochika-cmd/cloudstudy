package com.englishflow.gateway.config;

import com.englishflow.gateway.ApiGatewayApplication;
import com.englishflow.gateway.filter.ClientAuthorizationContextHeaders;
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
import org.springframework.http.HttpMethod;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.net.URI;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Uses the actual Gateway RouteLocator and JWT resource server. It proves the
 * RouteLocator has a two-way exact projection of the canonical policy and that
 * unavailable owners cannot fall through to broad legacy predicates.
 */
@SpringBootTest(
        classes = ApiGatewayApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "gateway.rate-limit.enabled=false",
                "gateway.rate-limit.backend=memory",
                "gateway.compatibility.enabled=false",
                "gateway.b12.enabled=true",
                "gateway.b13.enabled=true",
                // P1R decision 1A: recovery console routes resolve when enabled.
                "gateway.workflow.enabled=true",
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

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private RouteLocator routeLocator;

    @Autowired
    private ReactiveJwtDecoder jwtDecoder;

    @Autowired
    private GatewayRoutePolicy routePolicy;

    @Autowired
    private GatewayRouteExecutionPolicy routeExecutionPolicy;

    @Autowired
    private GatewayProperties gatewayProperties;

    private WebTestClient client;

    @DynamicPropertySource
    static void gatewayProperties(DynamicPropertyRegistry registry) {
        registry.add("gateway.security.resource-server-enabled", () -> "true");
        registry.add("gateway.security.jwt-prevalidation-enabled", () -> "true");
        registry.add("gateway.security.issuer-uri", () -> ISSUER);
        registry.add("gateway.security.jwk-set-uri", () -> "http://127.0.0.1:18087/jwks");
        registry.add("gateway.identity.iam-base-url", () -> "http://127.0.0.1:18087");
    }

    @BeforeEach
    void setUp() {
        client = WebTestClient.bindToApplicationContext(applicationContext)
                .build();
    }

    @Test
    void validJwtCannotTurnAnUnavailableCanonicalTargetIntoBroadWrongOwnerForwarding() throws Exception {
        List<String> routeIds = routeLocator.getRoutes().map(route -> route.getId()).collectList().block();
        assertTrue(routeIds.contains("canonical-iam-login-login"));
        // M6-008: account deletions are now an available canonical target.
        assertTrue(routeIds.stream().anyMatch(routeId -> routeId.startsWith("canonical-iam-account-deletions-")));
        assertFalse(routeIds.stream().anyMatch(routeId -> routeId.startsWith("canonical-grammar-domain-")));

        String token = validAccessToken();
        assertEquals("integration-subject", jwtDecoder.decode(token).block().getSubject());
        client.get()
                .uri("/api/v1/admin/recovery/tasks")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody().jsonPath("$.error.errorCode").isEqualTo("NOT_FOUND");

        client.delete()
                .uri("/api/v1/auth/login")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody().jsonPath("$.error.errorCode").isEqualTo("NOT_FOUND");

        client.post()
                .uri("/api/v1/grammar/practice/attempts")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody().jsonPath("$.error.errorCode").isEqualTo("NOT_FOUND");

        List.of(
                "/api/v1/commerce/wechat/callback",
                "/api/v1/commerce/alipay/notify",
                "/api/v1/commerce/apple/notifications"
        ).forEach(callback -> client.post()
                .uri(callback)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody().jsonPath("$.error.errorCode").isEqualTo("NOT_FOUND"));

        assertFalse(routeIds.stream().anyMatch(routeId -> routeId.startsWith("canonical-wechat-callback-")));
        assertFalse(routeIds.stream().anyMatch(routeId -> routeId.startsWith("canonical-alipay-callback-")));
        assertFalse(routeIds.stream().anyMatch(routeId -> routeId.startsWith("canonical-apple-notification-")));

    }

    @Test
    void everyCanonicalRuleHasAnExactExecutionOutcomeAndRoutableRulesSanitizeAuthorityHeaders() {
        List<org.springframework.cloud.gateway.route.Route> routes = routeLocator.getRoutes().collectList().block();
        Map<String, org.springframework.cloud.gateway.route.Route> canonicalRoutes = routes.stream()
                .filter(route -> route.getId().startsWith("canonical-"))
                .collect(java.util.stream.Collectors.toUnmodifiableMap(
                        org.springframework.cloud.gateway.route.Route::getId,
                        java.util.function.Function.identity()
                ));
        List<GatewayRouteExecutionPolicy.RouteBinding> bindings = routeExecutionPolicy.routeBindings();
        assertEquals(bindings.stream().map(GatewayRouteExecutionPolicy.RouteBinding::routeId).sorted().toList(),
                routes.stream().map(org.springframework.cloud.gateway.route.Route::getId).sorted().toList(),
                "RouteLocator must not retain any second, hand-maintained route table");
        assertEquals(bindings.stream().map(GatewayRouteExecutionPolicy.RouteBinding::routeId).sorted().toList(),
                canonicalRoutes.keySet().stream().sorted().toList(),
                "RouteLocator must expose exactly the executable canonical policy projection");
        for (GatewayRoutePolicy.Rule rule : routePolicy.rules()) {
            GatewayRouteExecutionPolicy.Resolution resolution = routeExecutionPolicy.resolve(rule);
            boolean hasRoute = bindings.stream().anyMatch(binding -> binding.rule().ruleId().equals(rule.ruleId()));
            assertEquals(resolution.isAvailable(), hasRoute,
                    () -> "route availability drift for " + rule.ruleId());
            assertEquals(resolution.isAvailable(), routeExecutionPolicy.isAvailable(rule),
                    () -> "route admission availability drift for " + rule.ruleId());
            if (!resolution.isAvailable()) {
                assertTrue(routeExecutionPolicy.failClosedReasons().containsKey(rule.ruleId()),
                        () -> "unavailable canonical rule must declare a fail-closed reason: " + rule.ruleId());
            }
        }
        assertEquals(List.of("gateway-health"), routeExecutionPolicy.localRules().stream()
                .map(GatewayRoutePolicy.Rule::ruleId)
                .toList(), "the only GATEWAY_LOCAL canonical rule must not be proxied");
        for (GatewayRouteExecutionPolicy.RouteBinding binding : bindings) {
            org.springframework.cloud.gateway.route.Route route = canonicalRoutes.get(binding.routeId());
            assertEquals(binding.targetUri(), route.getUri(), binding.routeId() + " target URI");
            if (binding.kind() == GatewayRouteExecutionPolicy.ExecutionKind.UPSTREAM) {
                assertEquals(expectedConfiguredOwnerUri(binding.rule().upstreamOwner()), binding.targetUri(),
                        binding.routeId() + " must use its canonical owner target");
            } else {
                assertEquals(GatewayRouteExecutionPolicy.ExecutionKind.LOCAL, binding.kind());
                assertEquals("gateway-health", binding.rule().ruleId());
                assertEquals(URI.create("forward:///internal/gateway/health"), binding.targetUri());
            }
            assertEquals(binding.metadata(), route.getMetadata(), binding.routeId() + " canonical metadata");
            assertEquals(-binding.rule().priority(), route.getOrder(), binding.routeId() + " route priority");
            assertRoutePredicateExact(route, binding);

            String filters = route.getFilters().toString();
            for (String forbidden : ClientAuthorizationContextHeaders.NAMES) {
                assertTrue(filters.contains(forbidden), binding.routeId() + " must remove " + forbidden);
            }
        }
    }

    @Test
    void gatewayLocalHealthNeverUsesCoreApiCompatibilityAndPreservesCanonicalCorrelationHeaders() {
        client.get()
                .uri("/api/v1/health")
                .header("X-Request-Id", "gateway-health-test")
                .header("X-Trace-Id", "trace-health-test")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals("X-Request-Id", "gateway-health-test")
                .expectHeader().valueEquals("X-Trace-Id", "trace-health-test")
                .expectHeader().valueEquals("X-API-Version", "v1")
                .expectHeader().valueEquals("X-RateLimit-Policy", "public-read")
                .expectBody()
                .jsonPath("$.data.status").isEqualTo("UP")
                .jsonPath("$.data.service").isEqualTo("api-gateway")
                .jsonPath("$.data.version").isEqualTo("1.0.0")
                .jsonPath("$.data.build").isEqualTo("p1r-m2-001-boundary")
                .jsonPath("$.data.dependencies").isArray()
                .jsonPath("$.meta.requestId").isEqualTo("gateway-health-test")
                .jsonPath("$.meta.traceId").isEqualTo("trace-health-test")
                .jsonPath("$.meta.apiVersion").isEqualTo("v1")
                .jsonPath("$.meta.schemaVersion").isEqualTo("1.0.0")
                .jsonPath("$.meta.serverTime").exists();
    }

    @Test
    void pathProjectionUsesOnlyCurrentOwnerControllerMappingsAndRejectsCrossOwnerRules() throws IOException {
        Path repository = repositoryRoot();
        for (GatewayRouteExecutionPolicy.RouteBinding binding : routeExecutionPolicy.routeBindings()) {
            GatewayRouteExecutionPolicy.ControllerEvidence evidence = binding.pathProjection().controllerEvidence();
            assertEquals(binding.rule().upstreamOwner(), evidence.ownerService(),
                    binding.routeId() + " owner evidence");
            Path source = repository.resolve(evidence.sourceRelativePath());
            assertTrue(Files.isRegularFile(source), binding.routeId() + " controller evidence source");
            assertTrue(Files.readString(source).contains(evidence.requestMapping()),
                    binding.routeId() + " current controller mapping");
        }

        assertProjected("assessment-domain", "session-create", HttpMethod.POST,
                "/api/v1/assessment/sessions", "/internal/v1/assessment/sessions");
        assertProjected("onboarding-domain", "daily-tasks-ensure", HttpMethod.POST,
                "/api/v1/onboarding/daily-tasks/ensure", "/internal/v1/learner/onboarding/daily-tasks/ensure");
        assertProjected("admin-domain", "commerce-orders", HttpMethod.GET,
                "/api/v1/admin/ops/commerce/orders", "/internal/v1/admin-ops/commerce/orders");
        assertProjected("notifications-domain", "preferences", HttpMethod.GET,
                "/api/v1/notifications/preferences", "/internal/v1/notifications/preferences");
        assertProjected("support-domain", "tickets", HttpMethod.POST,
                "/api/v1/support/tickets", "/internal/v1/admin-ops/support/tickets");
        assertProjected("learning-domain", "stream-today", HttpMethod.GET,
                "/api/v1/learning/stream/today", "/internal/v1/learning/stream/today");
        assertProjected("learning-domain", "today-v2", HttpMethod.GET,
                "/api/v1/learning/today", "/api/v1/learning/today");

        // The public site projection is served by content-service, which is also its canonical owner,
        // so it is a current owner mapping rather than the cross-owner conflict it used to be.
        assertProjected("public-site", "projection", HttpMethod.GET,
                "/api/v1/public/site/projection", "/api/v1/public/site/projection");

        assertUnavailable(HttpMethod.POST, "/api/v1/grammar/practice/attempts", "grammar-domain");
        assertUnavailable(HttpMethod.POST, "/api/v1/sync/changes", "sync-domain");
        assertUnavailable(HttpMethod.GET, "/api/v1/admin/recovery/tasks", "admin-recovery");
        assertUnavailable(HttpMethod.POST, "/api/v1/messages/message-1/read", "messages-domain");
        assertUnavailable(HttpMethod.POST, "/api/v1/social/rooms/room-1/disconnect", "social-domain");
        assertUnavailable(HttpMethod.POST, "/api/v1/social/rooms/room-1/recover", "social-domain");
        assertUnavailable(HttpMethod.POST, "/api/v1/social/rooms/room-1/lease/renew", "social-domain");
        assertUnavailable(HttpMethod.PUT, "/api/v1/settings/notifications", "settings-domain");
    }

    @Test
    void everyAvailableProjectionIsAnExactCurrentOpenApiOperationAndEveryOtherOperationFailsClosed() throws IOException {
        JsonNode paths = new ObjectMapper().readTree(Files.readString(
                        repositoryRoot().resolve("packages/contracts/openapi/v1/openapi.json")))
                .path("paths");
        List<GatewayRouteExecutionPolicy.RouteBinding> bindings = routeExecutionPolicy.routeBindings();
        for (GatewayRouteExecutionPolicy.RouteBinding binding : bindings) {
            String template = binding.pathProjection().publicPathTemplate();
            JsonNode pathItem = paths.path(template);
            assertTrue(pathItem.isObject(), binding.routeId() + " template must exist in OpenAPI");
            for (HttpMethod method : binding.methods()) {
                assertTrue(pathItem.path(method.name().toLowerCase(Locale.ROOT)).isObject(),
                        binding.routeId() + " method must exist in OpenAPI");
                String concretePath = materialize(template);
                GatewayRoutePolicy.Resolution resolution = routePolicy.resolve(method, concretePath);
                assertTrue(resolution.matched(), binding.routeId() + " must resolve in canonical policy");
                assertEquals(binding.rule().ruleId(), resolution.rule().ruleId(), binding.routeId() + " policy owner rule");
                assertTrue(routeExecutionPolicy.canExecute(resolution.rule(), method, concretePath), binding.routeId());
            }
        }

        for (Map.Entry<String, JsonNode> path : paths.properties()) {
            for (HttpMethod method : List.of(HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE)) {
                if (!path.getValue().path(method.name().toLowerCase(Locale.ROOT)).isObject()) {
                    continue;
                }
                GatewayRoutePolicy.Resolution resolution = routePolicy.resolve(method, path.getKey());
                if (!resolution.matched()) {
                    continue;
                }
                boolean mappedByExactProjection = bindings.stream()
                        .filter(binding -> binding.rule().ruleId().equals(resolution.rule().ruleId()))
                        .anyMatch(binding -> binding.pathProjection().accepts(method, path.getKey()));
                assertEquals(mappedByExactProjection,
                        routeExecutionPolicy.canExecute(resolution.rule(), method, path.getKey()),
                        () -> "canonical operation admission drift for " + method + " " + path.getKey());
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
                        true, true, true, ISSUER, "yuxuexing-api", "http://127.0.0.1:18087/jwks"
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

    private static void assertRoutePredicateExact(
            org.springframework.cloud.gateway.route.Route route,
            GatewayRouteExecutionPolicy.RouteBinding binding
    ) {
        for (String pattern : binding.externalPathPatterns()) {
            String path = samplePath(pattern);
            for (HttpMethod method : binding.methods()) {
                assertTrue(matches(route, method, path),
                        () -> binding.routeId() + " must match projected " + method + " " + path);
            }
        }
        String representativePath = samplePath(binding.externalPathPatterns().getFirst());
        assertFalse(matches(route, HttpMethod.HEAD, representativePath),
                () -> binding.routeId() + " must not infer HEAD from a canonical GET operation");
        HttpMethod deniedMethod = List.of(HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE, HttpMethod.OPTIONS)
                .stream()
                .filter(method -> !binding.methods().contains(method))
                .findFirst()
                .orElseThrow();
        assertFalse(matches(route, deniedMethod, representativePath),
                () -> binding.routeId() + " must not broaden methods beyond its execution projection");
        assertFalse(matches(route, binding.methods().getFirst(), binding.rule().path() + "-outside"),
                () -> binding.routeId() + " must not broaden its canonical path");
    }

    private void assertProjected(
            String ruleId,
            String projectionId,
            HttpMethod method,
            String publicPath,
            String expectedInternalPath
    ) {
        GatewayRouteExecutionPolicy.RouteBinding binding = routeExecutionPolicy.routeBindings().stream()
                .filter(candidate -> candidate.rule().ruleId().equals(ruleId))
                .filter(candidate -> candidate.pathProjection().bindingId().equals(projectionId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing projection " + ruleId + "/" + projectionId));
        assertTrue(binding.pathProjection().accepts(method, publicPath), binding.routeId());
        assertTrue(routeExecutionPolicy.canExecute(binding.rule(), method, publicPath), binding.routeId());
        assertEquals(expectedInternalPath, binding.pathProjection().transformedTargetPath(publicPath), binding.routeId());
    }

    private void assertUnavailable(HttpMethod method, String publicPath, String ruleId) {
        GatewayRoutePolicy.Resolution policyResolution = routePolicy.resolve(method, publicPath);
        assertTrue(policyResolution.matched(), publicPath + " must first resolve to canonical policy");
        assertEquals(ruleId, policyResolution.rule().ruleId());
        assertFalse(routeExecutionPolicy.canExecute(policyResolution.rule(), method, publicPath),
                () -> "unexpected projection admission for " + method + " " + publicPath + ": "
                        + routeExecutionPolicy.routeBindings().stream()
                        .filter(binding -> binding.rule().ruleId().equals(ruleId))
                        .filter(binding -> binding.pathProjection().accepts(method, publicPath))
                        .map(GatewayRouteExecutionPolicy.RouteBinding::routeId)
                        .toList());
        if (!routeExecutionPolicy.isAvailable(policyResolution.rule())) {
            assertTrue(routeExecutionPolicy.failClosedReasons().containsKey(ruleId),
                    () -> "whole-rule unavailability must expose a reason for " + ruleId);
        }
    }

    private static String samplePath(String pattern) {
        return pattern.replace("**", "exact-child").replace("*", "exact-child");
    }

    private static String materialize(String template) {
        return template.replaceAll("\\{[A-Za-z][A-Za-z0-9]*}", "projection-id");
    }

    private static Path repositoryRoot() {
        Path candidate = Path.of("").toAbsolutePath().normalize();
        while (candidate != null) {
            if (Files.isRegularFile(candidate.resolve("pom.xml"))
                    && Files.isRegularFile(candidate.resolve("packages/contracts/fragments/p1r-gateway-boundary.openapi.json"))) {
                return candidate;
            }
            candidate = candidate.getParent();
        }
        throw new IllegalStateException("Cannot find repository root");
    }

    private static MockServerWebExchange exchange(HttpMethod method, String path) {
        return MockServerWebExchange.from(MockServerHttpRequest.method(method, path).build());
    }

    private static boolean matches(org.springframework.cloud.gateway.route.Route route, HttpMethod method, String path) {
        return Boolean.TRUE.equals(Mono.from(route.getPredicate().apply(exchange(method, path))).block());
    }

    private URI expectedConfiguredOwnerUri(String owner) {
        return switch (owner) {
            case "iam-service" -> gatewayProperties.identity().iamUri();
            case "learner-service" -> gatewayProperties.b14().serviceUri("learner");
            case "content-service" -> gatewayProperties.b14().serviceUri("content");
            case "learning-service" -> gatewayProperties.b14().serviceUri("learning");
            case "assessment-service" -> gatewayProperties.b14().serviceUri("assessment");
            case "media-service" -> gatewayProperties.b14().serviceUri("media");
            case "gamification-service" -> gatewayProperties.b14().serviceUri("gamification");
            case "social-service" -> gatewayProperties.b14().serviceUri("social");
            case "commerce-service" -> gatewayProperties.b14().serviceUri("commerce");
            case "notification-service" -> gatewayProperties.b12().notificationUri();
            case "analytics-service" -> gatewayProperties.b13().analyticsUri();
            case "admin-ops-service" -> gatewayProperties.b13().adminOpsUri();
            // P1R decision 1A: recovery console route owner.
            case "workflow-service" -> gatewayProperties.workflow().workflowUri();
            default -> throw new AssertionError("no configured upstream is allowed for owner " + owner);
        };
    }
}
