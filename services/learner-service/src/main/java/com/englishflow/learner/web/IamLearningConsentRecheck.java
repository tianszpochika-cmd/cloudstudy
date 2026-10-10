package com.englishflow.learner.web;

import com.englishflow.learner.config.LearnerServiceProperties;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Objects;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Service-token read of IAM's current learning-consent fact. No consent result is cached. */
public final class IamLearningConsentRecheck implements LearningConsentRecheck {

    private final LearnerServiceProperties.ConsentRecheckProperties properties;
    private final HttpClient http;
    private final ObjectMapper json = new ObjectMapper();
    private volatile String serviceToken;

    public IamLearningConsentRecheck(LearnerServiceProperties.ConsentRecheckProperties properties) {
        this(properties, HttpClient.newBuilder().connectTimeout(Duration.ofMillis(800)).build());
    }

    IamLearningConsentRecheck(LearnerServiceProperties.ConsentRecheckProperties properties, HttpClient http) {
        this.properties = Objects.requireNonNull(properties, "properties");
        this.http = Objects.requireNonNull(http, "http");
    }

    @Override
    public boolean currentlyGranted(String principalId) {
        if (principalId == null || principalId.isBlank()) return false;
        try {
            String token = serviceToken();
            String path = "/internal/v1/iam/principals/"
                    + URLEncoder.encode(principalId, StandardCharsets.UTF_8) + "/learning-consent";
            HttpRequest request = HttpRequest.newBuilder(endpoint(path))
                    .timeout(Duration.ofMillis(800))
                    .header("Authorization", "Bearer " + token)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 401) {
                serviceToken = null;
                token = serviceToken();
                request = HttpRequest.newBuilder(request.uri())
                        .timeout(Duration.ofMillis(800))
                        .header("Authorization", "Bearer " + token)
                        .header("Accept", "application/json")
                        .GET()
                        .build();
                response = http.send(request, HttpResponse.BodyHandlers.ofString());
            }
            if (response.statusCode() != 200) return false;
            return granted(json.readTree(response.body()));
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return false;
        } catch (RuntimeException | IOException unavailable) {
            return false;
        }
    }

    static boolean granted(JsonNode body) {
        JsonNode data = body == null ? null : body.get("data");
        return data != null
                && "GRANTED".equals(data.path("learningConsent").asText())
                && "ELIGIBLE".equals(data.path("learningAccess").asText());
    }

    private String serviceToken() throws IOException, InterruptedException {
        String cached = serviceToken;
        if (cached != null) return cached;
        String secret = properties.getClientSecret();
        if (secret == null || secret.isBlank() || properties.getIamBaseUrl() == null
                || properties.getIamBaseUrl().isBlank()) {
            throw new IOException("learning consent recheck is not configured");
        }
        String payload = "{\"clientId\":" + quote(properties.getClientId())
                + ",\"clientSecret\":" + quote(secret) + "}";
        HttpRequest request = HttpRequest.newBuilder(endpoint("/internal/v1/iam/service-token"))
                .timeout(Duration.ofMillis(800))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("service token was not issued");
        }
        String token = json.readTree(response.body()).path("accessToken").asText();
        if (token == null || token.isBlank()) throw new IOException("service token was empty");
        serviceToken = token;
        return token;
    }

    private URI endpoint(String path) {
        String base = properties.getIamBaseUrl();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return URI.create(base + path);
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
