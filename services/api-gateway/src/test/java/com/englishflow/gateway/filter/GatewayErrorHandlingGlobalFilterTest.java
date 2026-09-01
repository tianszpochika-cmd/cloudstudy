package com.englishflow.gateway.filter;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewayErrorHandlingGlobalFilterTest {

    @Test
    void delayedUpstreamProcessResponseStatusTimeoutUsesCanonicalGatewayEnvelope() {
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/v1/auth/jwks")
                .header("X-Request-Id", "gateway-timeout-test")
                .header("X-Trace-Id", "trace-timeout-test")
                .build());

        new GatewayErrorHandlingGlobalFilter()
                .filter(exchange, ignored -> Mono.delay(Duration.ofMillis(25))
                        .then(Mono.error(new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT))))
                .block();

        assertEquals(HttpStatus.GATEWAY_TIMEOUT, exchange.getResponse().getStatusCode());
        assertEquals("v1", exchange.getResponse().getHeaders().getFirst("X-API-Version"));
        assertEquals("gateway-timeout-test", exchange.getResponse().getHeaders().getFirst("X-Request-Id"));
        assertEquals("trace-timeout-test", exchange.getResponse().getHeaders().getFirst("X-Trace-Id"));
        String body = exchange.getResponse().getBodyAsString().block();
        assertTrue(body.contains("\"errorCode\":\"SERVICE_UNAVAILABLE\""));
        assertTrue(body.contains("\"requestId\":\"gateway-timeout-test\""));
    }
}
