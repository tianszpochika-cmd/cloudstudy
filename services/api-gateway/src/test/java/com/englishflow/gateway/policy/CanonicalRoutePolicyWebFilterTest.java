package com.englishflow.gateway.policy;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.filter.CanonicalRoutePolicyWebFilter;
import com.englishflow.gateway.support.SecurityAuditRecorder;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CanonicalRoutePolicyWebFilterTest {

    @Test
    void rejectsCanonicalNoMatchBeforeTheRemainingChain() {
        GatewayRoutePolicy policy = new GatewayRoutePolicy();
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.patch("/api/v1/learning/test").build());
        boolean[] reached = new boolean[1];

        filter(policy).filter(exchange, forwarded -> {
            reached[0] = true;
            return Mono.empty();
        }).block();

        assertFalse(reached[0]);
        assertEquals(404, exchange.getResponse().getStatusCode().value());
        assertTrue(exchange.getResponse().getBodyAsString().block().contains("unknown_api_route"));
    }

    @Test
    void rejectsExternalInternalAliasesBeforeTheRemainingChain() {
        for (String path : List.of("/internal/v1/learning/test", "/api/v1/internal/learning/test")) {
            var exchange = MockServerWebExchange.from(MockServerHttpRequest.get(path).build());
            boolean[] reached = new boolean[1];

            filter(new GatewayRoutePolicy()).filter(exchange, forwarded -> {
                reached[0] = true;
                return Mono.empty();
            }).block();

            assertFalse(reached[0], path);
            assertEquals(404, exchange.getResponse().getStatusCode().value(), path);
            assertTrue(exchange.getResponse().getBodyAsString().block().contains("internal_route_not_public"), path);
        }
    }

    @Test
    void rejectsNonCanonicalPathsBeforeTheRemainingChain() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/unexpected").build());
        boolean[] reached = new boolean[1];

        filter(new GatewayRoutePolicy()).filter(exchange, forwarded -> {
            reached[0] = true;
            return Mono.empty();
        }).block();

        assertFalse(reached[0]);
        assertEquals(404, exchange.getResponse().getStatusCode().value());
        assertTrue(exchange.getResponse().getBodyAsString().block().contains("unknown_api_route"));
    }

    @Test
    void rejectsEqualPriorityResolutionBeforeTheRemainingChain() {
        GatewayRoutePolicy.Rule first = rule("first");
        GatewayRoutePolicy.Rule second = rule("second");
        GatewayRoutePolicy policy = new GatewayRoutePolicy(List.of(first, second));
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/v1/test").build());
        boolean[] reached = new boolean[1];

        filter(policy).filter(exchange, forwarded -> {
            reached[0] = true;
            return Mono.empty();
        }).block();

        assertFalse(reached[0]);
        assertEquals(404, exchange.getResponse().getStatusCode().value());
        assertTrue(exchange.getResponse().getBodyAsString().block().contains("ambiguous_api_route"));
    }

    @Test
    void permitsOnlyKnownPreflightAndActuatorPolicyExceptions() {
        for (MockServerHttpRequest request : List.of(
                MockServerHttpRequest.options("/api/v1/public/content/catalog")
                        .header("Access-Control-Request-Method", "GET").build(),
                MockServerHttpRequest.get("/actuator/health").build()
        )) {
            var exchange = MockServerWebExchange.from(request);
            boolean[] reached = new boolean[1];

            filter(new GatewayRoutePolicy()).filter(exchange, forwarded -> {
                reached[0] = true;
                return Mono.empty();
            }).block();

            assertTrue(reached[0]);
        }
    }

    private static CanonicalRoutePolicyWebFilter filter(GatewayRoutePolicy policy) {
        GatewayProperties properties = mock(GatewayProperties.class);
        when(properties.requestContext()).thenReturn(new GatewayProperties.RequestContext(128));
        when(properties.security()).thenReturn(new GatewayProperties.Security(
                false, false, false, null, null, null));
        SecurityAuditRecorder auditRecorder = new SecurityAuditRecorder(properties, policy, ignored -> { });
        return new CanonicalRoutePolicyWebFilter(properties, policy, auditRecorder);
    }

    private static GatewayRoutePolicy.Rule rule(String ruleId) {
        return new GatewayRoutePolicy.Rule(
                ruleId,
                100,
                GatewayRoutePolicy.MatchType.PREFIX,
                "/api/v1/test",
                List.of(HttpMethod.GET),
                "learning-service",
                "INTERNAL_V1",
                "AUTHENTICATED",
                GatewayRoutePolicy.AuthClass.AUTHENTICATED_READ,
                "NONE"
        );
    }
}
