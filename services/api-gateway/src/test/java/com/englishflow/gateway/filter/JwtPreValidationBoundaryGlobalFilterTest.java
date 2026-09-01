package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class JwtPreValidationBoundaryGlobalFilterTest {

    @Test
    void doesNotTreatBearerPresenceAsAuthenticationWhenVerifierIsUnavailable() {
        GatewayProperties properties = org.mockito.Mockito.mock(GatewayProperties.class);
        org.mockito.Mockito.when(properties.security()).thenReturn(
                new GatewayProperties.Security(true, false, true, "http://127.0.0.1:18087", "yuxuexing-api",
                        "http://127.0.0.1:18087/api/v1/auth/jwks"));
        org.mockito.Mockito.when(properties.requestContext()).thenReturn(new GatewayProperties.RequestContext(128));
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/v1/learner/profile")
                .header("Authorization", "Bearer not-a-jwt")
                .header("X-Request-Id", "safe-request")
                .header("X-Trace-Id", "safe-trace")
                .build());
        var reached = new boolean[1];

        new JwtPreValidationBoundaryGlobalFilter(properties, new GatewayRoutePolicy())
                .filter(exchange, ignored -> {
                    reached[0] = true;
                    return Mono.empty();
                })
                .block();

        assertFalse(reached[0]);
        assertEquals(503, exchange.getResponse().getStatusCode().value());
        assertEquals("safe-request", exchange.getResponse().getHeaders().getFirst("X-Request-Id"));
        assertEquals("safe-trace", exchange.getResponse().getHeaders().getFirst("X-Trace-Id"));
    }

    @Test
    void allowsPasswordLoginToReachIamWithoutAResourceServerToken() {
        GatewayProperties properties = org.mockito.Mockito.mock(GatewayProperties.class);
        org.mockito.Mockito.when(properties.security()).thenReturn(
                new GatewayProperties.Security(true, false, true, "https://iam.example.test", "yuxuexing-api",
                        "https://iam.example.test/api/v1/auth/jwks"));
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.post(
                "/api/v1/auth/login").build());
        var reached = new boolean[1];

        new JwtPreValidationBoundaryGlobalFilter(properties, new GatewayRoutePolicy())
                .filter(exchange, ignored -> {
                    reached[0] = true;
                    return Mono.empty();
                })
                .block();

        assertEquals(true, reached[0]);
    }

    @Test
    void allowsPublicJwksToReachIamWithoutAResourceServerToken() {
        GatewayProperties properties = org.mockito.Mockito.mock(GatewayProperties.class);
        org.mockito.Mockito.when(properties.security()).thenReturn(
                new GatewayProperties.Security(true, false, true, "https://iam.example.test", "yuxuexing-api",
                        "https://iam.example.test/api/v1/auth/jwks"));
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get(
                "/api/v1/auth/jwks").build());
        var reached = new boolean[1];

        new JwtPreValidationBoundaryGlobalFilter(properties, new GatewayRoutePolicy())
                .filter(exchange, ignored -> {
                    reached[0] = true;
                    return Mono.empty();
                })
                .block();

        assertEquals(true, reached[0]);
    }
}
