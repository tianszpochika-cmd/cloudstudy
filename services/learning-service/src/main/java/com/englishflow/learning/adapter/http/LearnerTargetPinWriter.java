package com.englishflow.learning.adapter.http;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

/**
 * Writes the verified placement pin onto the learner target through the
 * learner-owned internal pin endpoint. Values always come from a verified
 * placement report; learners never self-pin content through this writer.
 */
public final class LearnerTargetPinWriter {

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI pinUri;
    private final Duration timeout;

    public LearnerTargetPinWriter(ObjectMapper mapper, String learnerBaseUrl) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        String base = learnerBaseUrl == null ? "" : learnerBaseUrl.trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        if (!base.matches("https?://[^\\s]+")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "TARGET_PIN_UNAVAILABLE: learner base URL is invalid");
        }
        this.pinUri = URI.create(base + "/internal/v1/learner/targets/pin");
        this.timeout = Duration.ofSeconds(5);
    }

    public void pinTarget(String bearer, String idempotencyKey, long targetId,
                          long contentVersionId, long contentEpoch, String reportId) {
        Map<String, Object> body = Map.of("targetId", targetId, "contentVersionId", contentVersionId,
                "contentEpoch", contentEpoch, "placementReportId", reportId);
        String payload;
        try {
            payload = mapper.writeValueAsString(body);
        } catch (Exception invalid) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "TARGET_PIN_UNAVAILABLE: pin request cannot be serialized");
        }
        HttpRequest request = HttpRequest.newBuilder(pinUri).timeout(timeout)
                .header("Authorization", "Bearer " + bearer)
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .header("Idempotency-Key", idempotencyKey)
                .PUT(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8)).build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException | InterruptedException failed) {
            if (failed instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "TARGET_PIN_UNAVAILABLE: learner-service is unreachable");
        }
        if (response.statusCode() == 404) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "learner target is not initialized");
        }
        if (response.statusCode() == 409) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "target pin conflicts");
        }
        if (response.statusCode() != 200) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "TARGET_PIN_UNAVAILABLE: learner-service answered " + response.statusCode());
        }
    }
}
