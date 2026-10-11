package com.englishflow.assessment.adapter.content;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Exchanges this service's IAM client credentials for a short-lived service token (ADR-0016) and
 * caches it until shortly before expiry. Returns an empty string when IAM cannot issue one, so callers
 * keep failing closed instead of inventing an outcome.
 */
public final class IamServiceTokenSupplier implements Supplier<String> {
    static final Duration REFRESH_MARGIN = Duration.ofSeconds(30);

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI tokenUri;
    private final String clientId;
    private final String clientSecret;
    private final Clock clock;
    private String token = "";
    private Instant refreshAfter = Instant.EPOCH;

    public IamServiceTokenSupplier(ObjectMapper mapper, String iamBaseUrl, String clientId, String clientSecret) {
        this(mapper, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build(),
                iamBaseUrl, clientId, clientSecret, Clock.systemUTC());
    }

    IamServiceTokenSupplier(ObjectMapper mapper, HttpClient http, String iamBaseUrl, String clientId,
                            String clientSecret, Clock clock) {
        this.mapper = mapper;
        this.http = http;
        String base = iamBaseUrl.endsWith("/") ? iamBaseUrl.substring(0, iamBaseUrl.length() - 1) : iamBaseUrl;
        this.tokenUri = URI.create(base + "/internal/v1/iam/service-token");
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.clock = clock;
    }

    @Override
    public synchronized String get() {
        Instant now = clock.instant();
        if (!token.isBlank() && now.isBefore(refreshAfter)) return token;
        try {
            String body = mapper.writeValueAsString(Map.of("clientId", clientId, "clientSecret", clientSecret));
            HttpRequest request = HttpRequest.newBuilder(tokenUri).timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) return invalidate();
            JsonNode json = mapper.readTree(response.body());
            JsonNode source = json.has("accessToken") ? json : json.path("data");
            String issued = source.path("accessToken").asText("");
            long expiresIn = source.path("expiresIn").asLong(120);
            if (issued.isBlank() || issued.contains("\r") || issued.contains("\n")) return invalidate();
            token = issued;
            refreshAfter = now.plusSeconds(Math.max(1, expiresIn - REFRESH_MARGIN.toSeconds()));
            return token;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return invalidate();
        } catch (RuntimeException | java.io.IOException unavailable) {
            return invalidate();
        }
    }

    /** Drops the cached token, e.g. after the content owner rejected it. */
    public synchronized String invalidate() {
        token = "";
        refreshAfter = Instant.EPOCH;
        return "";
    }
}
