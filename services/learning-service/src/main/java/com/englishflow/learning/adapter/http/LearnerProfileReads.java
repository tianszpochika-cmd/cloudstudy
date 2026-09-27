package com.englishflow.learning.adapter.http;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

/** Learner profile + preferences reads for plan assembly (versions, locale, zone, study days). */
public final class LearnerProfileReads {

    public record LearnerProfileFacts(
            long profileVersion,
            String contentLocale,
            String timezone,
            long preferenceVersion,
            List<Integer> weeklyStudyDays) {
    }

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI profileUri;
    private final URI preferencesUri;
    private final Duration timeout;

    public LearnerProfileReads(ObjectMapper mapper, String learnerBaseUrl) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        String base = normalize(learnerBaseUrl);
        this.profileUri = URI.create(base + "/api/v1/learner/profile");
        this.preferencesUri = URI.create(base + "/api/v1/learner/preferences");
        this.timeout = Duration.ofSeconds(5);
    }

    public LearnerProfileFacts read(String bearer) {
        Map<String, Object> profile = get(profileUri, bearer, "learner profile");
        Map<String, Object> preferences = get(preferencesUri, bearer, "learner preferences");
        if (!(profile.get("stateVersion") instanceof Number profileVersion)
                || profileVersion.longValue() < 1) {
            throw unprocessable("learner profile version is invalid");
        }
        String contentLocale = stringOrNull(profile.get("contentLocale"));
        String timezone = stringOrNull(profile.get("timezone"));
        if (contentLocale == null || timezone == null) throw unprocessable("learner profile is incomplete");
        long preferenceVersion = preferences.get("stateVersion") instanceof Number number
                && number.longValue() > 0 ? number.longValue() : 1L;
        List<Integer> days = days(preferences.get("weeklyStudyDays"));
        return new LearnerProfileFacts(profileVersion.longValue(), contentLocale, timezone,
                preferenceVersion, days);
    }

    private static List<Integer> days(Object raw) {
        if (raw instanceof List<?> list && !list.isEmpty()
                && list.stream().allMatch(Number.class::isInstance)) {
            List<Integer> parsed = list.stream().map(day -> ((Number) day).intValue()).toList();
            if (parsed.stream().allMatch(day -> day >= 1 && day <= 7)
                    && parsed.stream().distinct().count() == parsed.size()) {
                return List.copyOf(parsed);
            }
        }
        return List.of(1, 2, 3, 4, 5, 6, 7);
    }

    private static String stringOrNull(Object value) {
        return value instanceof String text && !text.isBlank() ? text : null;
    }

    private Map<String, Object> get(URI uri, String bearer, String what) {
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(timeout)
                .header("Authorization", "Bearer " + bearer)
                .header("Accept", "application/json").GET().build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException | InterruptedException failed) {
            if (failed instanceof InterruptedException) Thread.currentThread().interrupt();
            throw unavailable("learner-service is unreachable");
        }
        if (response.statusCode() == 404) throw unprocessable(what + " is not found");
        if (response.statusCode() != 200) throw unavailable("learner-service answered " + response.statusCode());
        try {
            Object decoded = mapper.readValue(response.body(), Object.class);
            if (decoded instanceof Map<?, ?> envelope && envelope.get("data") instanceof Map<?, ?> data) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) data;
                return result;
            }
        } catch (Exception invalid) {
            throw unavailable("learner-service payload is invalid");
        }
        throw unavailable("learner-service payload has no data");
    }

    private static String normalize(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) throw unavailable("learner base URL is not configured");
        String normalized = baseUrl.trim();
        while (normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
        if (!normalized.matches("https?://[^\\s]+")) throw unavailable("learner base URL is invalid");
        return normalized;
    }

    private static ResponseStatusException unprocessable(String message) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "LEARNER_PROFILE_UNAVAILABLE: " + message);
    }
}
