package com.englishflow.gateway.support;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewayErrorResponseWriterTest {

    @ParameterizedTest
    @MethodSource("canonicalBoundaryFailures")
    void writesCanonicalOpenApiEnvelopeForEveryBoundaryFailure(int status, String expectedErrorCode) {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/example").build());

        GatewayErrorResponseWriter.write(exchange, new GatewayError(
                status,
                "internal_reason_only",
                "Safe failure message.",
                "request-12345",
                "0123456789abcdef0123456789abcdef"
        )).block();

        String body = exchange.getResponse().getBodyAsString().block();
        assertEquals(status, exchange.getResponse().getStatusCode().value());
        assertEquals("v1", exchange.getResponse().getHeaders().getFirst("X-API-Version"));
        assertEquals("request-12345", exchange.getResponse().getHeaders().getFirst("X-Request-Id"));
        assertEquals("0123456789abcdef0123456789abcdef", exchange.getResponse().getHeaders().getFirst("X-Trace-Id"));
        assertTrue(body.contains("\"errorCode\":\"" + expectedErrorCode + "\""), body);
        assertTrue(body.contains("\"meta\":{\"requestId\":\"request-12345\""), body);
        assertTrue(body.contains("\"traceId\":\"0123456789abcdef0123456789abcdef\""), body);
        assertTrue(body.contains("\"apiVersion\":\"v1\""), body);
        assertTrue(body.contains("\"schemaVersion\":\"1.0.0\""), body);
        assertTrue(body.contains("\"serverTime\":\""), body);
        if (status == 401) {
            assertEquals("Bearer", exchange.getResponse().getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE));
        }
        if (status == 429 || status == 503) {
            assertEquals("1", exchange.getResponse().getHeaders().getFirst(HttpHeaders.RETRY_AFTER));
        }
    }

    private static Stream<Arguments> canonicalBoundaryFailures() {
        return Stream.of(
                Arguments.of(401, "AUTH_REQUIRED"),
                Arguments.of(403, "FORBIDDEN"),
                Arguments.of(404, "NOT_FOUND"),
                Arguments.of(429, "RATE_LIMITED"),
                Arguments.of(503, "SERVICE_UNAVAILABLE"),
                Arguments.of(504, "SERVICE_UNAVAILABLE")
        );
    }
}
