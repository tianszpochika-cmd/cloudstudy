package com.englishflow.learning.adapter.http;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

import tools.jackson.databind.ObjectMapper;

/**
 * Reads assessment-owned ZERO mistakes for the caller. Learning does not open
 * the assessment schema. The same facts are written to
 * {@code learning.mistake.admitted.v1} in the assessment outbox; this feed is
 * the local consumer while the Kafka relay is off.
 */
public final class HttpAssessmentMistakeFeed {
    private static final Logger LOG = Logger.getLogger(HttpAssessmentMistakeFeed.class.getName());

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String assessmentBaseUrl;

    public HttpAssessmentMistakeFeed(ObjectMapper mapper, String assessmentBaseUrl) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        String base = assessmentBaseUrl == null ? "" : assessmentBaseUrl.trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        this.assessmentBaseUrl = base;
    }

    public List<Map<String, Object>> list(String bearer) {
        if (bearer == null || bearer.isBlank() || !assessmentBaseUrl.startsWith("http")) return List.of();
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(assessmentBaseUrl + "/internal/v1/assessment/mistakes"))
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + bearer.trim())
                    .timeout(Duration.ofSeconds(4))
                    .GET()
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                LOG.warning("assessment mistake feed returned " + response.statusCode());
                return List.of();
            }
            return parse(response.body());
        } catch (Exception exception) {
            LOG.warning("assessment mistake feed unavailable: " + exception.getClass().getSimpleName());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> parse(String body) {
        try {
            Object parsed = mapper.readValue(body, Object.class);
            Object data = parsed instanceof Map<?, ?> map ? map.get("data") : null;
            Object items = data instanceof Map<?, ?> dataMap ? dataMap.get("items") : null;
            if (!(items instanceof List<?> list)) return List.of();
            List<Map<String, Object>> facts = new ArrayList<>();
            for (Object entry : list) {
                if (!(entry instanceof Map<?, ?> raw)) continue;
                Map<String, Object> fact = new LinkedHashMap<>();
                fact.put("itemId", raw.get("itemId"));
                fact.put("scoreBucket", raw.get("scoreBucket") == null ? "ZERO" : raw.get("scoreBucket"));
                fact.put("errorCategory", raw.get("errorCategory"));
                fact.put("contentCode", raw.get("contentCode"));
                fact.put("sourceAttemptId", sourceAttempt(raw));
                facts.add(fact);
            }
            return facts;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private static String sourceAttempt(Map<?, ?> raw) {
        Object direct = raw.get("sourceAttemptId");
        if (direct != null && !String.valueOf(direct).isBlank()) return String.valueOf(direct).trim();
        Object trace = raw.get("reasonTrace");
        if (!(trace instanceof List<?> entries)) return "";
        String found = "";
        for (Object entry : entries) {
            if (!(entry instanceof Map<?, ?> row)) continue;
            Object value = row.get("sourceAttemptId");
            if (value != null && !String.valueOf(value).isBlank()) found = String.valueOf(value).trim();
        }
        return found;
    }
}
