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
 * Verifies a P1 placement report (and its session) with assessment-service
 * for plans:ensure. Only an owner-verified ASSESSED completion yields pins;
 * skips, foreign reports and mismatches fail closed. Assessment already
 * enforces report ownership (403 on mismatch); this adapter additionally
 * requires the caller subject to match and the session to be COMPLETED.
 */
public final class VerifiedPlacementReport {

    public record PlacementPins(
            String sessionId,
            long sessionStateVersion,
            String sessionSnapshotDigest,
            String placementResultId,
            long resultVersion,
            String resultDigest,
            String reportId,
            long reportVersion,
            String reportDigest,
            String resultKind,
            String confidence,
            String referenceLevel,
            String completedAt,
            long targetId,
            long targetVersion,
            String targetSnapshotDigest,
            long contentVersionId,
            long contentEpoch,
            String snapshotId,
            String snapshotHash,
            String answerRuleSetVersion,
            String answerRuleVersion,
            String ruleDigest,
            Map<String, Object> manifest) {
    }

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String assessmentBaseUrl;
    private final Duration timeout;

    public VerifiedPlacementReport(ObjectMapper mapper, String assessmentBaseUrl) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        String base = assessmentBaseUrl == null ? "" : assessmentBaseUrl.trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        if (!base.matches("https?://[^\\s]+")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "PLAN_REPORT_UNAVAILABLE: assessment base URL is invalid");
        }
        this.assessmentBaseUrl = base;
        this.timeout = Duration.ofSeconds(5);
    }

    public PlacementPins verify(String reportId, String bearer) {
        if (reportId == null || reportId.isBlank() || bearer == null || bearer.isBlank()) {
            throw unprocessable("placement report reference is invalid");
        }
        Map<String, Object> report = get("/internal/v1/assessment/placement/reports/" + reportId, bearer);
        Map<String, Object> result = object(report.get("result"), "placement result is missing");
        if (!"ASSESSED".equals(result.get("resultKind"))) {
            throw unprocessable("only an assessed placement can pin a plan");
        }
        String sessionId = text(result.get("sessionId"), "placement session is missing");
        Map<String, Object> session = get("/internal/v1/assessment/placement/sessions/" + sessionId, bearer);
        if (!"COMPLETED".equals(session.get("status"))) {
            throw unprocessable("placement session is not complete");
        }
        Map<String, Object> targetPin = object(report.get("targetPin"), "placement target pin is missing");
        Map<String, Object> contentPin = object(report.get("contentPin"), "placement content pin is missing");
        Map<String, Object> rulePin = object(report.get("answerRulePin"), "placement rule pin is missing");
        return new PlacementPins(
                sessionId,
                positiveLong(session.get("stateVersion"), "placement session version"),
                token(session.get("sessionSnapshotDigest"), "placement session digest"),
                text(result.get("placementResultId"), "placement result is missing"),
                positiveLong(result.get("resultVersion"), "placement result version"),
                digest(result.get("resultDigest"), "placement result digest"),
                text(result.get("reportId"), "placement report is missing"),
                positiveLong(result.get("reportVersion"), "placement report version"),
                digest(result.get("reportDigest"), "placement report digest"),
                "ASSESSED",
                text(result.get("confidence"), "placement confidence is missing"),
                text(result.get("referenceLevel"), "placement level is missing"),
                text(result.get("completedAt"), "placement completion time is missing"),
                positiveLong(targetPin.get("targetId"), "placement target id"),
                positiveLong(targetPin.get("targetVersion"), "placement target version"),
                digest(targetPin.get("targetSnapshotDigest"), "placement target digest"),
                positiveLong(contentPin.get("contentVersionId"), "placement content version"),
                nonNegativeLong(contentPin.get("contentEpoch"), "placement content epoch"),
                text(contentPin.get("snapshotId"), "placement snapshot id"),
                digest(contentPin.get("snapshotHash"), "placement snapshot hash"),
                text(rulePin.get("answerRuleSetVersion"), "placement rule set version"),
                text(rulePin.get("answerRuleVersion"), "placement rule version"),
                digest(rulePin.get("ruleDigest"), "placement rule digest"),
                object(report.get("manifest"), "placement manifest is missing"));
    }

    private Map<String, Object> get(String path, String bearer) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(assessmentBaseUrl + path)).timeout(timeout)
                .header("Authorization", "Bearer " + bearer)
                .header("Accept", "application/json").GET().build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException | InterruptedException failed) {
            if (failed instanceof InterruptedException) Thread.currentThread().interrupt();
            throw unavailable("assessment-service is unreachable");
        }
        if (response.statusCode() == 404) {
            throw unprocessable("placement report is not found");
        }
        if (response.statusCode() == 403) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "placement report owner mismatch");
        }
        if (response.statusCode() != 200) throw unavailable("assessment-service answered " + response.statusCode());
        try {
            Object decoded = mapper.readValue(response.body(), Object.class);
            if (decoded instanceof Map<?, ?> envelope && envelope.get("data") instanceof Map<?, ?> data) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) data;
                return result;
            }
        } catch (Exception invalid) {
            throw unavailable("assessment-service payload is invalid");
        }
        throw unavailable("assessment-service payload has no data");
    }

    private Map<String, Object> object(Object value, String message) {
        if (value instanceof Map<?, ?> map && !map.isEmpty()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) map;
            return result;
        }
        throw unprocessable(message);
    }

    private static String text(Object value, String message) {
        if (value instanceof String text && !text.isBlank()) return text;
        throw unprocessable(message);
    }

    private static String token(Object value, String message) {
        return text(value, message);
    }

    private static String digest(Object value, String message) {
        String text = text(value, message);
        if (!text.matches("[a-f0-9]{64}")) throw unprocessable(message);
        return text;
    }

    private static long positiveLong(Object value, String message) {
        if (value instanceof Number number && number.longValue() > 0) return number.longValue();
        throw unprocessable(message);
    }

    private static long nonNegativeLong(Object value, String message) {
        if (value instanceof Number number && number.longValue() >= 0) return number.longValue();
        throw unprocessable(message);
    }

    private static ResponseStatusException unprocessable(String message) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "PLAN_REPORT_UNAVAILABLE: " + message);
    }
}
