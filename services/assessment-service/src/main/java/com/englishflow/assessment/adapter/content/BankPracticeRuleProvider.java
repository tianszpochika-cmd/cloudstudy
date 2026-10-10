package com.englishflow.assessment.adapter.content;

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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Practice rules for the canonical placement bank, resolved over HTTP from
 * content-service's sealed bank endpoint. Assessment keeps no master copy:
 * every call re-reads the sealed snapshot, so a bank change can never grade
 * against stale stems. Any failure returns {@code null} and the caller keeps
 * its existing unavailable-content behavior (410 at session creation); rules
 * are never invented, substituted from legacy sets, or persisted here.
 *
 * <p>The sealed route does not carry {@code answerRule}. A stray correct
 * option on that payload is ignored. Each row is marked
 * {@code grader=PLACEMENT_SCORE} so the attempt path asks the service-token
 * score port, which is the only place the stored option is read.
 * {@code BASIC_GRAMMAR} maps to the B10 {@code GRAMMAR} dimension word; bank
 * option objects already carry {@code optionId/label} which the B10 learner
 * projection reads directly.
 */
public final class BankPracticeRuleProvider {

    public static final String BANK_CODE = "p1.placement.v1";
    public static final String BANK_CONTENT_CODE = "p1.placement.v1";

    public record BankRules(long contentVersionId, long contentEpoch,
                            String snapshotHash, List<Map<String, Object>> rows) {
    }

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String contentBaseUrl;
    private final Duration timeout;

    public BankPracticeRuleProvider(ObjectMapper mapper, String contentBaseUrl) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        this.contentBaseUrl = contentBaseUrl == null ? "" : contentBaseUrl.replaceAll("/$", "");
        this.timeout = Duration.ofSeconds(5);
    }

    public BankRules fetch(String contentCode, long contentVersionId, String authorization) {
        if (!BANK_CONTENT_CODE.equals(contentCode) || contentVersionId < 1
                || authorization == null || authorization.isBlank()) {
            return null;
        }
        Map<String, Object> bank = get(authorization);
        if (bank == null || !"P1_PLACEMENT_V1".equals(bank.get("bankCode"))) return null;
        if (!(bank.get("contentVersionId") instanceof Number version)
                || version.longValue() != contentVersionId) {
            return null;
        }
        long epoch = bank.get("contentEpoch") instanceof Number number && number.longValue() >= 0
                ? number.longValue() : 0L;
        if (!(bank.get("snapshotHash") instanceof String snapshotHash)
                || !snapshotHash.matches("[a-f0-9]{64}")) {
            return null;
        }
        if (!(bank.get("items") instanceof List<?> values) || values.isEmpty()) return null;
        try {
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Object rawItem : values) {
                if (!(rawItem instanceof Map<?, ?> raw)) return null;
                @SuppressWarnings("unchecked")
                Map<String, Object> item = (Map<String, Object>) raw;
                rows.add(row(item, contentVersionId));
            }
            return new BankRules(contentVersionId, epoch, snapshotHash, List.copyOf(rows));
        } catch (ResponseStatusException miss) {
            // A drifted bank shape is unavailable practice content, not a 500:
            // the B10 caller keeps its 410 behavior.
            return null;
        }
    }

    private Map<String, Object> row(Map<String, Object> item, long contentVersionId) {
        if (!(item.get("itemId") instanceof Number itemId) || itemId.longValue() < 1) {
            throw unavailable();
        }
        String dimension = switch (String.valueOf(item.get("dimension"))) {
            case "VOCABULARY" -> "VOCABULARY";
            case "BASIC_GRAMMAR" -> "GRAMMAR";
            case "READING" -> "READING";
            case "LISTENING" -> "LISTENING";
            default -> throw unavailable();
        };
        if (!dimension.equals(switch (String.valueOf(item.get("itemType"))) {
            case "VOCABULARY" -> "VOCABULARY";
            case "GRAMMAR" -> "GRAMMAR";
            case "READING" -> "READING";
            case "LISTENING" -> "LISTENING";
            default -> "";
        })) {
            throw unavailable();
        }
        if (!(item.get("stem") instanceof String stem) || stem.isBlank()) throw unavailable();
        if (!(item.get("options") instanceof List<?> options) || options.size() < 2
                || options.size() > 32) {
            throw unavailable();
        }
        java.util.Set<String> optionIds = new java.util.HashSet<>();
        for (Object rawOption : options) {
            if (!(rawOption instanceof Map<?, ?> option)
                    || !(option.get("optionId") instanceof String optionId) || optionId.isBlank()
                    || !(option.get("label") instanceof String label) || label.isBlank()
                    || !optionIds.add(optionId)) {
                throw unavailable();
            }
        }
        // answerRule stays in content-service. Do not copy correctOption even
        // if a caller attached it to the sealed item.
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("item_id", String.valueOf(itemId.longValue()));
        row.put("content_version_id", contentVersionId);
        row.put("prompt", stem);
        row.put("options_json", json(item.get("options")));
        row.put("dimension", dimension);
        row.put("answer_rule_json", json(Map.of("grader", "PLACEMENT_SCORE")));
        return row;
    }

    private Map<String, Object> get(String authorization) {
        try {
            HttpRequest request = HttpRequest
                    .newBuilder(URI.create(contentBaseUrl + "/internal/v1/content/placement-bank/sealed"))
                    .timeout(timeout).header("Authorization", authorization)
                    .header("Accept", "application/json").GET().build();
            HttpResponse<String> response = http.send(request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) return null;
            Object decoded = mapper.readValue(response.body(), Object.class);
            if (decoded instanceof Map<?, ?> envelope && envelope.get("data") instanceof Map<?, ?> data) {
                @SuppressWarnings("unchecked")
                Map<String, Object> bank = (Map<String, Object>) data;
                return bank;
            }
            return null;
        } catch (IOException | InterruptedException | RuntimeException failed) {
            if (failed instanceof InterruptedException) Thread.currentThread().interrupt();
            return null;
        }
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception invalid) {
            throw unavailable();
        }
    }

    private static ResponseStatusException unavailable() {
        // Internal seam failure: the B10 caller maps a null BankRules to its
        // existing 410 unavailable-content behavior, never to a 500.
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "bank practice rules are unavailable");
    }
}
