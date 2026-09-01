package com.englishflow.gateway.policy;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
}
