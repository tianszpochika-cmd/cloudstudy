package com.englishflow.assessment.adapter.content;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class IamServiceTokenSupplierTest {
    private final ObjectMapper mapper = JsonMapper.builder().build();
    private HttpServer server;

    @AfterEach
    void stop() {
        if (server != null) server.stop(0);
    }

    private String start(int status, String body, AtomicInteger calls, AtomicReference<String> seen) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/iam/service-token", exchange -> {
            calls.incrementAndGet();
            seen.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @Test
    void exchangesClientCredentialsAndCachesUntilNearExpiry() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        AtomicReference<String> seen = new AtomicReference<>();
        String base = start(200, "{\"accessToken\":\"svc-token\",\"expiresIn\":300}", calls, seen);
        IamServiceTokenSupplier supplier = new IamServiceTokenSupplier(mapper, HttpClient.newHttpClient(), base,
                "assessment-service", "s3cret", Clock.fixed(Instant.parse("2026-10-11T00:00:00Z"), ZoneOffset.UTC));

        assertThat(supplier.get()).isEqualTo("svc-token");
        assertThat(supplier.get()).isEqualTo("svc-token");
        assertThat(calls.get()).isEqualTo(1);
        assertThat(seen.get()).contains("\"clientId\":\"assessment-service\"").contains("\"clientSecret\":\"s3cret\"");

        supplier.invalidate();
        assertThat(supplier.get()).isEqualTo("svc-token");
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    void failsClosedWithEmptyTokenWhenIamRefuses() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        String base = start(401, "{}", calls, new AtomicReference<>());
        IamServiceTokenSupplier supplier = new IamServiceTokenSupplier(mapper, HttpClient.newHttpClient(), base,
                "assessment-service", "wrong", Clock.systemUTC());
        assertThat(supplier.get()).isEmpty();
    }
}
