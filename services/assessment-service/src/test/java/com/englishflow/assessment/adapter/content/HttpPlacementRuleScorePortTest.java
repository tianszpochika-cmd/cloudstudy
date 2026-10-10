package com.englishflow.assessment.adapter.content;

import com.englishflow.assessment.port.PlacementRuleScorePort;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The score client sends a service token and drops any answer-bearing payload. */
class HttpPlacementRuleScorePortTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void forwardsTheOptionUnchangedAndReturnsFullOrZero() throws Exception {
        AtomicReference<String> authorization = new AtomicReference<>();
        AtomicReference<String> body = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        try {
            server.createContext("/internal/v1/content/placement-bank/score", exchange -> {
                authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
                body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                boolean padded = body.get().contains("\"selectedOptionId\":\"a \"");
                String selected = !padded && body.get().contains("\"selectedOptionId\":\"a\"") ? "FULL" : "ZERO";
                String explanation = "FULL".equals(selected)
                        ? PlacementRuleScorePort.FULL_EXPLANATION : PlacementRuleScorePort.ZERO_EXPLANATION;
                byte[] response = mapper.writeValueAsString(java.util.Map.of("data", java.util.Map.of(
                        "itemId", 266001, "outcome", selected, "explanation", explanation)))
                        .getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, response.length);
                exchange.getResponseBody().write(response);
                exchange.close();
            });
            server.start();
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            HttpPlacementRuleScorePort port = new HttpPlacementRuleScorePort(
                    mapper, baseUrl, "svc-token-value", Duration.ofSeconds(2));
            PlacementRuleScorePort.RuleScore full = port.score(266001L, "a");
            assertEquals("FULL", full.outcome());
            assertEquals(PlacementRuleScorePort.FULL_EXPLANATION, full.explanation());
            assertEquals("Bearer svc-token-value", authorization.get());
            assertFalse(body.get().contains("correctOption"));

            PlacementRuleScorePort.RuleScore padded = port.score(266001L, "a ");
            assertEquals("ZERO", padded.outcome());
            assertTrue(body.get().contains("\"selectedOptionId\":\"a \""));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void correctOptionInThePayloadFailsClosed() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        try {
            server.createContext("/internal/v1/content/placement-bank/score", exchange -> {
                byte[] response = "{\"data\":{\"itemId\":266001,\"outcome\":\"FULL\",\"explanation\":\"Selected option equals the stored answer rule.\",\"correctOption\":\"a\"}}"
                        .getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, response.length);
                exchange.getResponseBody().write(response);
                exchange.close();
            });
            server.start();
            HttpPlacementRuleScorePort port = new HttpPlacementRuleScorePort(mapper,
                    "http://127.0.0.1:" + server.getAddress().getPort(), "svc-token-value", Duration.ofSeconds(2));
            ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                    () -> port.score(266001L, "a"));
            assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
            assertFalse(String.valueOf(failure.getReason()).contains("correctOption"));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void missingServiceTokenDoesNotCallAndDoesNotInventAnOutcome() throws Exception {
        AtomicInteger hits = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        try {
            server.createContext("/internal/v1/content/placement-bank/score", exchange -> {
                hits.incrementAndGet();
                exchange.sendResponseHeaders(500, -1);
                exchange.close();
            });
            server.start();
            HttpPlacementRuleScorePort port = new HttpPlacementRuleScorePort(mapper,
                    "http://127.0.0.1:" + server.getAddress().getPort(), "", Duration.ofSeconds(2));
            ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                    () -> port.score(266001L, "a"));
            assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
            assertEquals(0, hits.get());
        } finally {
            server.stop(0);
        }
    }
}
