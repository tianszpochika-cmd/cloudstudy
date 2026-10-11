package com.englishflow.assessment.adapter.content;

import com.englishflow.assessment.domain.SafePayloads;
import com.englishflow.assessment.port.PlacementRuleScorePort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Scores one accepted placement choice by asking content-service.
 * The learner JWT is never forwarded. A missing service token fails closed
 * and does not invent FULL, ZERO or a correct option.
 */
public final class HttpPlacementRuleScorePort implements PlacementRuleScorePort {
    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI scoreUri;
    private final Supplier<String> serviceToken;
    private final Duration timeout;

    public HttpPlacementRuleScorePort(ObjectMapper mapper, String contentBaseUrl, String serviceToken,
                                      Duration timeout) {
        this(mapper, contentBaseUrl, staticToken(serviceToken), timeout);
    }

    /** Uses a token source (e.g. IAM client-credential exchange) instead of a fixed token. */
    public HttpPlacementRuleScorePort(ObjectMapper mapper, String contentBaseUrl, Supplier<String> serviceToken,
                                      Duration timeout) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        this.scoreUri = URI.create(normalize(contentBaseUrl) + "/internal/v1/content/placement-bank/score");
        this.serviceToken = serviceToken == null ? () -> "" : serviceToken;
        this.timeout = timeout == null || timeout.isNegative() || timeout.isZero()
                ? Duration.ofSeconds(5) : timeout;
    }

    private static Supplier<String> staticToken(String serviceToken) {
        if (serviceToken != null && (serviceToken.contains("\r") || serviceToken.contains("\n"))) {
            throw new IllegalArgumentException("placement score service token is invalid");
        }
        String fixed = serviceToken == null ? "" : serviceToken;
        return () -> fixed;
    }

    @Override
    public RuleScore score(long itemId, String selectedOptionId) {
        String serviceToken = this.serviceToken.get();
        if (serviceToken == null || serviceToken.isBlank()) {
            throw unavailable("placement rule score requires a service token");
        }
        if (itemId < 1 || selectedOptionId == null) {
            throw unavailable("placement rule score request is invalid");
        }
        String body;
        try {
            body = mapper.writeValueAsString(Map.of("itemId", itemId, "selectedOptionId", selectedOptionId));
        } catch (RuntimeException invalid) {
            throw unavailable("placement rule score request is invalid");
        }
        HttpRequest request = HttpRequest.newBuilder(scoreUri).timeout(timeout)
                .header("Authorization", "Bearer " + serviceToken)
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (java.io.IOException | InterruptedException failed) {
            if (failed instanceof InterruptedException) Thread.currentThread().interrupt();
            throw unavailable("placement rule score is unreachable");
        }
        if (response.statusCode() != 200) {
            if ((response.statusCode() == 401 || response.statusCode() == 403)
                    && this.serviceToken instanceof IamServiceTokenSupplier iam) {
                iam.invalidate();
            }
            throw unavailable("placement rule score answered " + response.statusCode());
        }
        return parse(itemId, response.body());
    }

    private RuleScore parse(long itemId, String raw) {
        try {
            Object decoded = mapper.readValue(raw, Object.class);
            if (!(decoded instanceof Map<?, ?> envelope) || !(envelope.get("data") instanceof Map<?, ?> data)) {
                throw unavailable("placement rule score payload has no data");
            }
            if (SafePayloads.containsSensitive(data) || raw.contains("correctOption")) {
                throw unavailable("placement rule score leaked answer material");
            }
            if (!(data.get("itemId") instanceof Number number) || number.longValue() != itemId
                    || !(data.get("outcome") instanceof String outcome)
                    || !(data.get("explanation") instanceof String explanation)) {
                throw unavailable("placement rule score payload is invalid");
            }
            return new RuleScore(outcome, explanation);
        } catch (ResponseStatusException expected) {
            throw expected;
        } catch (RuntimeException invalid) {
            throw unavailable("placement rule score payload is invalid");
        }
    }

    private static String normalize(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("placement score content base url is required");
        }
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
    }
}
