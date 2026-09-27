package com.englishflow.learning.adapter.http;

import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningTaskType;
import com.englishflow.learning.port.PublishedContentPort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Plan task seeds over HTTP from content-service's placement-bank plan-items
 * endpoint. Only identifiers and display order cross the boundary (no stems,
 * options or answer rules); learning assigns task types and planned dates.
 *
 * <p>Date rule (documented Phase-1 placement-plan rule): three seeds per day
 * starting today in the learner's zone, so a 15-minute quota (≈3 items) lands
 * one day of work at a time. The rule is scheduling, not measurement.
 */
public final class HttpPlanContentPort implements PublishedContentPort {

    private static final int SEEDS_PER_DAY = 3;

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI planItemsUri;
    private final URI profileUri;
    private final Duration timeout;

    public HttpPlanContentPort(ObjectMapper mapper, String contentBaseUrl, String learnerBaseUrl) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        this.planItemsUri = URI.create(normalize(contentBaseUrl)
                + "/internal/v1/content/placement-bank/plan-items");
        this.profileUri = URI.create(normalize(learnerBaseUrl) + "/api/v1/learner/profile");
        this.timeout = Duration.ofSeconds(5);
    }

    @Override
    public Optional<PublishedContentSnapshot> findLearnerSnapshot(
            LearningPrincipalContext principal, long contentVersionId) {
        if (contentVersionId < 1) return Optional.empty();
        String bearer = BearerTokens.current();
        if (bearer == null) return Optional.empty();
        Map<String, Object> bank = get(planItemsUri, bearer);
        if (bank == null || !"P1_PLACEMENT_V1".equals(bank.get("bankCode"))) return Optional.empty();
        if (!(bank.get("contentVersionId") instanceof Number version)
                || version.longValue() != contentVersionId) {
            return Optional.empty();
        }
        if (!(bank.get("contentEpoch") instanceof Number epoch) || epoch.longValue() < 1) {
            return Optional.empty();
        }
        if (!(bank.get("items") instanceof List<?> values) || values.isEmpty()) return Optional.empty();
        if (!(bank.get("contentStateVersion") instanceof Number stateVersion)
                || stateVersion.longValue() < 1) {
            return Optional.empty();
        }
        try {
            ZoneId zone = zoneOf(profile(bearer));
            LocalDate today = LocalDate.now(zone);
            List<LearningSeedItem> seeds = new ArrayList<>();
            for (Object rawItem : values) {
                if (!(rawItem instanceof Map<?, ?> raw)) return Optional.empty();
                @SuppressWarnings("unchecked")
                Map<String, Object> item = (Map<String, Object>) raw;
                seeds.add(seed(item, today));
            }
            return Optional.of(new PublishedContentSnapshot(contentVersionId, epoch.longValue(),
                    "p1.placement.v1", Set.of("LEARNER"), List.copyOf(seeds), stateVersion.longValue()));
        } catch (IllegalArgumentException invalid) {
            return Optional.empty();
        }
    }

    private LearningSeedItem seed(Map<String, Object> item, LocalDate today) {
        if (!(item.get("itemId") instanceof Number itemId) || itemId.longValue() < 1) {
            throw new IllegalArgumentException("plan seed item id is invalid");
        }
        String dimension = String.valueOf(item.get("dimension"));
        LearningItemType itemType = switch (dimension) {
            case "VOCABULARY" -> LearningItemType.VOCAB;
            case "BASIC_GRAMMAR" -> LearningItemType.GRAMMAR;
            case "READING" -> LearningItemType.READING;
            case "LISTENING" -> LearningItemType.EXERCISE;
            default -> throw new IllegalArgumentException("plan seed dimension is unknown");
        };
        LearningTaskType taskType = switch (dimension) {
            case "VOCABULARY" -> LearningTaskType.VOCABULARY_REVIEW;
            case "BASIC_GRAMMAR" -> LearningTaskType.GRAMMAR_PRACTICE;
            case "READING" -> LearningTaskType.READING;
            case "LISTENING" -> LearningTaskType.LISTENING_DICTATION;
            default -> throw new IllegalArgumentException("plan seed dimension is unknown");
        };
        if (!(item.get("displayOrder") instanceof Number order) || order.intValue() < 1) {
            throw new IllegalArgumentException("plan seed order is invalid");
        }
        LocalDate planned = today.plusDays((order.intValue() - 1) / SEEDS_PER_DAY);
        return new LearningSeedItem(itemType, itemId.longValue(), taskType, planned);
    }

    private ZoneId zoneOf(Map<String, Object> profile) {
        if (profile == null) throw new IllegalArgumentException("learner profile is unavailable");
        return ZoneId.of(String.valueOf(profile.get("timezone")));
    }

    private Map<String, Object> profile(String bearer) {
        return get(profileUri, bearer);
    }

    private Map<String, Object> get(URI uri, String bearer) {
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(timeout)
                .header("Authorization", "Bearer " + bearer)
                .header("Accept", "application/json").GET().build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException | InterruptedException failed) {
            if (failed instanceof InterruptedException) Thread.currentThread().interrupt();
            throw unavailable("content-service is unreachable");
        }
        if (response.statusCode() == 404) return null;
        if (response.statusCode() != 200) throw unavailable("content-service answered " + response.statusCode());
        try {
            Object decoded = mapper.readValue(response.body(), Object.class);
            if (decoded instanceof Map<?, ?> envelope && envelope.get("data") instanceof Map<?, ?> data) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) data;
                return result;
            }
        } catch (Exception invalid) {
            throw unavailable("content-service payload is invalid");
        }
        throw unavailable("content-service payload has no data");
    }

    private static String normalize(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) throw unavailable("content base URL is not configured");
        String normalized = baseUrl.trim();
        while (normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
        if (!normalized.matches("https?://[^\\s]+")) throw unavailable("content base URL is invalid");
        return normalized;
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "PLAN_CONTENT_UNAVAILABLE: " + message);
    }
}
