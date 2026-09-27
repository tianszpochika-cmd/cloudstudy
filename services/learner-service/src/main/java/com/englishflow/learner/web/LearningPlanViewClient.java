package com.englishflow.learner.web;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import tools.jackson.databind.ObjectMapper;

/**
 * Reads the owner-assembled plan view from learning-service for the home
 * projection (ADR: home reads learning projection).
 *
 * <p>Phase 1 forwards the incoming verified learner JWT until validated
 * workload identity lands. Any transport or shape problem yields empty (the
 * home stays honestly NOT_READY) — a learning outage must never become a
 * fabricated plan or a broken home page.
 */
public class LearningPlanViewClient {

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private final URI viewUri;
    private final Duration timeout = Duration.ofSeconds(5);

    public LearningPlanViewClient(String learningBaseUrl) {
        String base = learningBaseUrl == null ? "" : learningBaseUrl.trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        this.viewUri = URI.create(base + "/internal/v1/learning/plans/current-view");
    }

    public Optional<Map<String, Object>> fetchView(Authentication authentication) {
        String bearer = bearer(authentication);
        if (bearer == null) return Optional.empty();
        try {
            HttpRequest request = HttpRequest.newBuilder(viewUri).timeout(timeout)
                    .header("Authorization", "Bearer " + bearer)
                    .header("Accept", "application/json").GET().build();
            HttpResponse<String> response = http.send(request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) return Optional.empty();
            Object decoded = mapper.readValue(response.body(), Object.class);
            if (decoded instanceof Map<?, ?> envelope && envelope.get("data") instanceof Map<?, ?> data) {
                @SuppressWarnings("unchecked")
                Map<String, Object> view = (Map<String, Object>) data;
                return Optional.of(view);
            }
            return Optional.empty();
        } catch (IOException | InterruptedException | RuntimeException failed) {
            if (failed instanceof InterruptedException) Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }

    private static String bearer(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt && jwt.isAuthenticated()
                && jwt.getToken().getTokenValue() != null && !jwt.getToken().getTokenValue().isBlank()) {
            return jwt.getToken().getTokenValue();
        }
        return null;
    }
}
