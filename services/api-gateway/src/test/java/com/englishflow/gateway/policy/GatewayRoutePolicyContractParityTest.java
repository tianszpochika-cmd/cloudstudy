package com.englishflow.gateway.policy;

import com.englishflow.gateway.config.GatewayProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The production resolver intentionally has an executable in-service copy of
 * the frozen gateway boundary. This test prevents it drifting from the source
 * contract without editing that contract from this module.
 */
class GatewayRoutePolicyContractParityTest {

    private final GatewayRoutePolicy routePolicy = new GatewayRoutePolicy();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void runtimeProjectionEqualsEveryCanonicalRouteRule() throws IOException {
        JsonNode sourceRules = objectMapper.readTree(Files.readString(contractPath()))
                .path("x-p1r-gateway-boundary")
                .path("routeRules");
        List<RouteRuleProjection> expected = new ArrayList<>();
        for (JsonNode source : sourceRules) {
            JsonNode match = source.path("match");
            List<String> methods = new ArrayList<>();
            for (JsonNode method : match.path("methods")) {
                methods.add(method.asText());
            }
            expected.add(new RouteRuleProjection(
                    source.path("ruleId").asText(),
                    source.path("priority").asInt(),
                    match.path("type").asText(),
                    match.path("path").asText(),
                    methods,
                    source.path("upstreamOwner").asText(),
                    source.path("internalTargetClass").asText(),
                    source.path("visibility").asText(),
                    source.path("authClass").asText(),
                    source.path("compatibilityMode").asText()
            ));
        }

        List<RouteRuleProjection> actual = routePolicy.rules().stream()
                .map(rule -> new RouteRuleProjection(
                        rule.ruleId(),
                        rule.priority(),
                        rule.matchType().name(),
                        rule.path(),
                        rule.methods().stream().map(HttpMethod::name).toList(),
                        rule.upstreamOwner(),
                        rule.internalTargetClass(),
                        rule.visibility(),
                        rule.authClass().name(),
                        rule.compatibilityMode()))
                .toList();

        assertEquals(expected, actual);
    }

    @Test
    void runtimeExecutionProjectionEqualsTheSourceOwnedRouteExecutionsExactly() throws IOException {
        JsonNode boundary = objectMapper.readTree(Files.readString(contractPath()))
                .path("x-p1r-gateway-boundary");
        JsonNode targetPolicy = boundary.path("executionTargetPolicy");
        assertEquals("routeExecutions", targetPolicy.path("sourceOfTruth").asText());
        assertEquals("UNAVAILABLE", targetPolicy.path("defaultExecutionStatus").asText());
        assertEquals("DENY", targetPolicy.path("unknownPathDecision").asText());
        assertEquals("FORBIDDEN", targetPolicy.path("legacyCoreApiFallback").asText());

        List<ExecutionPlanProjection> expected = new ArrayList<>();
        for (JsonNode plan : boundary.path("routeExecutions")) {
            List<ExecutionProjection> projections = new ArrayList<>();
            for (JsonNode projection : plan.path("projections")) {
                List<String> methods = new ArrayList<>();
                for (JsonNode method : projection.path("methods")) {
                    methods.add(method.asText());
                }
                JsonNode evidence = projection.path("controllerEvidence");
                projections.add(new ExecutionProjection(
                        projection.path("projectionId").asText(),
                        projection.path("status").asText(),
                        projection.path("publicPathTemplate").asText(),
                        methods,
                        projection.path("executionKind").asText(),
                        projection.path("upstreamOwner").asText(),
                        projection.path("targetUriConfig").asText(),
                        projection.path("pathStrategy").asText(),
                        projection.path("targetPathTemplate").asText(),
                        evidence.path("sourcePath").asText(),
                        evidence.path("requestMapping").asText()
                ));
            }
            expected.add(new ExecutionPlanProjection(
                    plan.path("ruleId").asText(),
                    plan.path("defaultStatus").asText(),
                    plan.path("defaultReason").asText(),
                    projections.stream().sorted(Comparator.comparing(ExecutionProjection::projectionId)).toList()
            ));
        }

        GatewayRouteExecutionPolicy executionPolicy = new GatewayRouteExecutionPolicy(
                executableGatewayProperties(), routePolicy);
        Map<String, List<GatewayRouteExecutionPolicy.RouteBinding>> bindingsByRule = executionPolicy.routeBindings().stream()
                .collect(Collectors.groupingBy(
                        binding -> binding.rule().ruleId(), LinkedHashMap::new, Collectors.toList()));
        List<ExecutionPlanProjection> actual = routePolicy.rules().stream()
                .map(rule -> new ExecutionPlanProjection(
                        rule.ruleId(),
                        "UNAVAILABLE",
                        executionPolicy.defaultUnavailableReason(rule),
                        bindingsByRule.getOrDefault(rule.ruleId(), List.of()).stream()
                                .map(binding -> runtimeProjection(rule, binding))
                                .sorted(Comparator.comparing(ExecutionProjection::projectionId))
                                .toList()))
                .toList();

        assertEquals(expected, actual,
                "Gateway's only RouteLocator execution source must remain an exact projection of routeExecutions");
    }

    @Test
    void resolverUsesTheHighestPriorityRuleForSharedPrefixesAndPreflight() {
        GatewayRoutePolicy.Resolution export = routePolicy.resolve(
                HttpMethod.POST, "/api/v1/privacy/exports/request-1");
        assertTrue(export.matched());
        assertEquals("privacy-exports", export.rule().ruleId());
        assertEquals(GatewayRoutePolicy.AuthClass.AUTHENTICATED_WRITE, export.rule().authClass());

        GatewayRoutePolicy.Resolution preflight = routePolicy.resolvePreflight(
                MockServerHttpRequest.options("/api/v1/public/content/lesson-1")
                        .header("Access-Control-Request-Method", "GET")
                        .build());
        assertTrue(preflight.matched());
        assertEquals(GatewayRoutePolicy.AuthClass.PUBLIC_READ, preflight.rule().authClass());

        GatewayRoutePolicy.Resolution offlineRead = routePolicy.resolve(
                HttpMethod.GET, "/api/v1/sync/offline-packages");
        assertTrue(offlineRead.matched());
        assertEquals("sync-offline-packages-read", offlineRead.rule().ruleId());
        assertEquals("notification-service", offlineRead.rule().upstreamOwner());
        assertEquals(GatewayRoutePolicy.AuthClass.AUTHENTICATED_READ, offlineRead.rule().authClass());
        GatewayRoutePolicy.Resolution offlinePreflight = routePolicy.resolvePreflight(
                MockServerHttpRequest.options("/api/v1/sync/offline-packages")
                        .header("Access-Control-Request-Method", "GET")
                        .build());
        assertEquals("sync-offline-packages-read", offlinePreflight.rule().ruleId());
        assertEquals("sync-domain", routePolicy.resolve(
                HttpMethod.POST, "/api/v1/sync/offline-packages/package-1/authorize").rule().ruleId());

        GatewayRoutePolicy.Resolution moderationRead = routePolicy.resolve(
                HttpMethod.GET, "/api/v1/admin/moderation/reports");
        assertEquals("admin-moderation-reports-read", moderationRead.rule().ruleId());
        assertEquals("social-service", moderationRead.rule().upstreamOwner());
        GatewayRouteExecutionPolicy executionPolicy = new GatewayRouteExecutionPolicy(
                executableGatewayProperties(), routePolicy);
        assertTrue(executionPolicy.canExecute(moderationRead.rule(), HttpMethod.GET,
                "/api/v1/admin/moderation/reports"));
        assertFalse(executionPolicy.canExecute(routePolicy.resolve(HttpMethod.POST,
                "/api/v1/admin/moderation/reports/any/commands").rule(), HttpMethod.POST,
                "/api/v1/admin/moderation/reports/any/commands"),
                "moderation write commands remain denied without an audited owner boundary");

        assertFalse(routePolicy.resolve(HttpMethod.HEAD, "/api/v1/public/content/lesson-1").matched(),
                "HEAD must not inherit a GET operation that the canonical contract does not declare");
    }

    @Test
    void grammarPointsReadUsesTheExactContentOwnerProjectionWhileOtherGrammarRoutesStayWithheld() {
        GatewayRouteExecutionPolicy executionPolicy = new GatewayRouteExecutionPolicy(
                executableGatewayProperties(), routePolicy);
        GatewayRoutePolicy.Resolution points = routePolicy.resolve(HttpMethod.GET, "/api/v1/grammar/points");
        assertTrue(points.matched());
        assertEquals("grammar-points-read", points.rule().ruleId());
        assertEquals(GatewayRoutePolicy.MatchType.EXACT, points.rule().matchType());
        assertEquals("content-service", points.rule().upstreamOwner());
        assertEquals(GatewayRoutePolicy.AuthClass.AUTHENTICATED_READ, points.rule().authClass());
        assertTrue(executionPolicy.canExecute(points.rule(), HttpMethod.GET, "/api/v1/grammar/points"));

        GatewayRouteExecutionPolicy.RouteBinding projection = executionPolicy.routeBindings().stream()
                .filter(binding -> binding.rule().ruleId().equals("grammar-points-read"))
                .findFirst().orElseThrow();
        assertEquals("/internal/v1/content/learner/grammar/points",
                projection.pathProjection().targetPathTemplate());
        assertEquals("services/content-service/src/main/java/com/englishflow/content/web/B3ContentJdbcController.java",
                projection.pathProjection().controllerEvidence().sourceRelativePath());

        GatewayRoutePolicy.Rule broadGrammar = routePolicy.rules().stream()
                .filter(rule -> rule.ruleId().equals("grammar-domain"))
                .findFirst().orElseThrow();
        assertEquals("assessment-service", broadGrammar.upstreamOwner());
        assertEquals(GatewayRoutePolicy.MatchType.PREFIX, broadGrammar.matchType());
        assertEquals(List.of(HttpMethod.GET, HttpMethod.POST), broadGrammar.methods());

        for (var request : List.of(
                Map.entry(HttpMethod.GET, "/api/v1/grammar/points/3101"),
                Map.entry(HttpMethod.GET, "/api/v1/grammar/tree"),
                Map.entry(HttpMethod.POST, "/api/v1/grammar/points"),
                Map.entry(HttpMethod.POST, "/api/v1/grammar/practice/attempts"))) {
            GatewayRoutePolicy.Resolution withheld = routePolicy.resolve(request.getKey(), request.getValue());
            assertEquals("grammar-domain", withheld.rule().ruleId(), request.getValue());
            assertFalse(executionPolicy.canExecute(withheld.rule(), request.getKey(), request.getValue()),
                    request.getValue() + " must remain withheld");
        }
    }

    @Test
    void b25PlacementStartWriteIsNotExecutableWhileTheOldReadAndSessionCreateRemain() {
        GatewayRouteExecutionPolicy executionPolicy = new GatewayRouteExecutionPolicy(
                executableGatewayProperties(), routePolicy);

        GatewayRoutePolicy.Resolution startWrite = routePolicy.resolve(
                HttpMethod.POST, "/api/v1/assessment/placement/start");
        assertTrue(startWrite.matched());
        assertEquals("assessment-domain", startWrite.rule().ruleId());
        assertFalse(executionPolicy.canExecute(startWrite.rule(), HttpMethod.POST,
                "/api/v1/assessment/placement/start"),
                "POST /placement/start must not be forwarded to the B25 write port");

        GatewayRoutePolicy.Resolution startRead = routePolicy.resolve(
                HttpMethod.GET, "/api/v1/assessment/placement/start");
        assertTrue(executionPolicy.canExecute(startRead.rule(), HttpMethod.GET,
                "/api/v1/assessment/placement/start"));
        GatewayRouteExecutionPolicy.RouteBinding read = executionPolicy.routeBindings().stream()
                .filter(binding -> "placement-start".equals(binding.pathProjection().bindingId()))
                .findFirst()
                .orElseThrow();
        assertEquals(List.of(HttpMethod.GET), read.methods());
        assertEquals("/internal/v1/assessment/placement/start",
                read.pathProjection().transformedTargetPath("/api/v1/assessment/placement/start"));

        GatewayRoutePolicy.Resolution sessionCreate = routePolicy.resolve(
                HttpMethod.POST, "/api/v1/assessment/placement/sessions");
        assertTrue(executionPolicy.canExecute(sessionCreate.rule(), HttpMethod.POST,
                "/api/v1/assessment/placement/sessions"));
        GatewayRouteExecutionPolicy.RouteBinding create = executionPolicy.routeBindings().stream()
                .filter(binding -> binding.pathProjection().accepts(
                        HttpMethod.POST, "/api/v1/assessment/placement/sessions"))
                .findFirst()
                .orElseThrow();
        assertEquals("/internal/v1/assessment/placement/sessions",
                create.pathProjection().transformedTargetPath("/api/v1/assessment/placement/sessions"));
    }

    @Test
    void providerCallbacksStayFailClosedUntilCommerceOwnsTheSignedExternalBoundary() {
        GatewayRouteExecutionPolicy executionPolicy = new GatewayRouteExecutionPolicy(
                executableGatewayProperties(), routePolicy);
        Map<String, String> callbacks = Map.of(
                "/api/v1/commerce/wechat/callback", "wechat-callback",
                "/api/v1/commerce/alipay/notify", "alipay-callback",
                "/api/v1/commerce/apple/notifications", "apple-notification"
        );

        callbacks.forEach((path, ruleId) -> {
            GatewayRoutePolicy.Resolution route = routePolicy.resolve(HttpMethod.POST, path);
            assertTrue(route.matched(), path + " must retain its canonical owner rule");
            assertEquals(ruleId, route.rule().ruleId());
            assertFalse(executionPolicy.canExecute(route.rule(), HttpMethod.POST, path),
                    path + " must not proxy to a workload-only controller");
            assertEquals("commerce_provider_callback_signature_boundary_not_implemented",
                    executionPolicy.defaultUnavailableReason(route.rule()));
        });
    }

    private static Path contractPath() {
        Path candidate = Path.of("").toAbsolutePath().normalize();
        while (candidate != null) {
            Path contract = candidate.resolve("packages/contracts/fragments/p1r-gateway-boundary.openapi.json");
            if (Files.isRegularFile(contract)) {
                return contract;
            }
            candidate = candidate.getParent();
        }
        throw new IllegalStateException("Cannot locate the canonical Gateway boundary contract from the test working directory");
    }

    private static ExecutionProjection runtimeProjection(
            GatewayRoutePolicy.Rule rule,
            GatewayRouteExecutionPolicy.RouteBinding binding
    ) {
        GatewayRouteExecutionPolicy.PathProjection projection = binding.pathProjection();
        GatewayRouteExecutionPolicy.ControllerEvidence evidence = projection.controllerEvidence();
        return new ExecutionProjection(
                rule.ruleId() + "." + projection.bindingId(),
                "AVAILABLE",
                projection.publicPathTemplate(),
                projection.methods().stream().map(HttpMethod::name).toList(),
                binding.kind().name(),
                rule.upstreamOwner(),
                binding.targetUriConfig(),
                projection.strategy().name(),
                projection.targetPathTemplate(),
                evidence.sourceRelativePath(),
                evidence.requestMapping()
        );
    }

    private static GatewayProperties executableGatewayProperties() {
        Map<String, String> b14Targets = Map.of(
                "learner", "http://127.0.0.1:28088",
                "content", "http://127.0.0.1:28089",
                "learning", "http://127.0.0.1:28090",
                "assessment", "http://127.0.0.1:28091",
                "media", "http://127.0.0.1:28092",
                "gamification", "http://127.0.0.1:28094",
                "social", "http://127.0.0.1:28095",
                "commerce", "http://127.0.0.1:28096"
        );
        Map<String, String> b14Modes = b14Targets.keySet().stream()
                .collect(Collectors.toUnmodifiableMap(domain -> domain, ignored -> "TARGET"));
        return new GatewayProperties(
                new GatewayProperties.Compatibility(false, "http://127.0.0.1:28080", false),
                new GatewayProperties.Identity(true, "http://127.0.0.1:28087"),
                new GatewayProperties.B12Services(true, "http://127.0.0.1:28094", "http://127.0.0.1:28095", "http://127.0.0.1:28093"),
                new GatewayProperties.B13Services(true, "http://127.0.0.1:28096", "http://127.0.0.1:28097", "http://127.0.0.1:28098"),
                new GatewayProperties.B14Services(true, false, "2027-06-30T00:00:00Z", b14Targets, b14Modes),
                // P1R decision 1A: recovery console route owner.
                new GatewayProperties.WorkflowServices(true, "http://127.0.0.1:28071"),                new GatewayProperties.Cors(
                        "http://127.0.0.1:28180", "http://127.0.0.1:28181", "http://127.0.0.1:28183", "http://127.0.0.1:28182",
                        "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Authorization", "Content-Type", "X-Request-Id", "refresh", "NATIVE_SECURE_STORAGE", Duration.ofMinutes(30)),
                new GatewayProperties.RateLimit(false, "memory", 32, false, Duration.ofMillis(100), Map.of()),
                new GatewayProperties.RequestContext(128),
                new GatewayProperties.Security(true, true, true, "https://iam.contract-parity.test", "yuxuexing-api", "http://127.0.0.1:28087/jwks")
        );
    }

    private record RouteRuleProjection(
            String ruleId,
            int priority,
            String matchType,
            String path,
            List<String> methods,
            String upstreamOwner,
            String internalTargetClass,
            String visibility,
            String authClass,
            String compatibilityMode
    ) {
    }

    private record ExecutionPlanProjection(
            String ruleId,
            String defaultStatus,
            String defaultReason,
            List<ExecutionProjection> projections
    ) {
    }

    private record ExecutionProjection(
            String projectionId,
            String status,
            String publicPathTemplate,
            List<String> methods,
            String executionKind,
            String upstreamOwner,
            String targetUriConfig,
            String pathStrategy,
            String targetPathTemplate,
            String sourcePath,
            String requestMapping
    ) {
    }
}
