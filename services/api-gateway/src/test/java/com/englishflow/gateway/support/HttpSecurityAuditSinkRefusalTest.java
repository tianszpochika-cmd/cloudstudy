package com.englishflow.gateway.support;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * What the sink does when its credential has been refused.
 *
 * <p>A short-lived service token is refused routinely at the moment it expires, and treating that as an outage would
 * lose the audit fact rather than renew the token. The sink asks for a new one and retries exactly once. A second
 * refusal is a failure, not a loop, because retrying a credential that is genuinely wrong would turn an
 * authorisation problem into a flood.
 *
 * <p>The server is a real one on a loopback port, since what is being tested is the sequence of requests: two calls,
 * the second with a different token.
 */
class HttpSecurityAuditSinkRefusalTest {

    private static SecurityAuditRecord record() {
        return new SecurityAuditRecord(Instant.parse("2026-09-14T12:00:00Z"), "learner-roster", "GET", 401,
                "req-1", "trace-1", "a".repeat(64), "b".repeat(64), "browser", "DENY", "AUTH_REQUIRED", "lt-10");
    }

    /** Starts a server that answers with the given statuses in order and records the tokens it saw. */
    private static HttpServer server(List<Integer> statuses, List<String> tokens) throws java.io.IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicInteger call = new AtomicInteger();
        server.createContext("/audit", (exchange) -> {
            tokens.add(String.valueOf(exchange.getRequestHeaders().getFirst("authorization")));
            int index = Math.min(call.getAndIncrement(), statuses.size() - 1);
            byte[] body = "{}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(statuses.get(index), body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        return server;
    }

    @Test
    void aRefusedTokenIsReplacedAndTheDeliveryRetriedOnce() throws Exception {
        List<String> tokens = new CopyOnWriteArrayList<>();
        HttpServer server = server(List.of(401, 202), tokens);
        AtomicInteger issued = new AtomicInteger();
        try {
            URI endpoint = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/audit");
            // The supplier returns a different token after a refusal, which is what a real one does.
            HttpSecurityAuditSink sink = new HttpSecurityAuditSink(endpoint,
                    (afterRefusal) -> "token-" + issued.incrementAndGet(), Duration.ofSeconds(5));

            sink.send(record());

            assertEquals(List.of("Bearer token-1", "Bearer token-2"), tokens);
            assertTrue(sink.counters().get("delivered") == 1L, sink.counters().toString());
            assertTrue(sink.counters().get("refusedTokens") == 1L, sink.counters().toString());
            assertTrue(sink.counters().get("failed") == 0L, sink.counters().toString());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void aSecondRefusalIsAFailureRatherThanAnotherRetry() throws Exception {
        List<String> tokens = new CopyOnWriteArrayList<>();
        HttpServer server = server(List.of(401, 401, 202), tokens);
        AtomicInteger issued = new AtomicInteger();
        try {
            URI endpoint = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/audit");
            HttpSecurityAuditSink sink = new HttpSecurityAuditSink(endpoint,
                    (afterRefusal) -> "token-" + issued.incrementAndGet(), Duration.ofSeconds(5));

            sink.send(record());

            // Two attempts, not three: the third response is never reached.
            assertEquals(2, tokens.size(), tokens.toString());
            assertTrue(sink.counters().get("failed") == 1L, sink.counters().toString());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void noTokenMeansNothingIsSent() throws Exception {
        List<String> tokens = new CopyOnWriteArrayList<>();
        HttpServer server = server(List.of(202), tokens);
        try {
            URI endpoint = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/audit");
            HttpSecurityAuditSink sink = new HttpSecurityAuditSink(endpoint, (afterRefusal) -> "", Duration.ofSeconds(5));

            sink.send(record());

            // Sending without a token would produce a 401 and make an authentication problem look like a delivery
            // problem, so nothing is sent and the failure is counted.
            assertEquals(0, tokens.size(), tokens.toString());
            assertTrue(sink.counters().get("failed") == 1L, sink.counters().toString());
        } finally {
            server.stop(0);
        }
    }
}
