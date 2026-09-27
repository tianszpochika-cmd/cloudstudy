package com.englishflow.content.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

/**
 * Sealed P1 placement bank owned by content-service.
 *
 * <p>Serves the canonical ten-item {@code P1_PLACEMENT_V1} snapshot (3 VOCABULARY /
 * 3 BASIC_GRAMMAR / 2 READING / 2 LISTENING) with ACTIVE rights to the
 * assessment-service internal adapter. Answer rules cross this internal boundary
 * only and are never projected to the browser: assessment splits learner items
 * from sealed scoring input. The route stays internal-only (loopback, Gateway
 * DENY) and Phase 1 carries the caller's verified learner JWT until validated
 * workload identity lands (see the {@code transportInterim} contract note on
 * {@code getPlacementBankSealedSnapshot}). Any bank shape drift fails closed
 * with 503 instead of serving a substituted or partial manifest.
 */
@RestController
@RequestMapping("/internal/v1/content/placement-bank")
@ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
public final class PlacementBankSealedController {

    private static final String TENANT = "platform";
    private static final String BANK = "P1_PLACEMENT_V1";
    private static final String BANK_CONTENT_ID = "p1-placement-bank-v1";
    private static final String ANSWER_RULE_SET_VERSION = "p1-placement-bank-v1";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public PlacementBankSealedController(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/sealed")
    public Map<String, Object> sealed(Authentication authentication) {
        ContentHttpPrincipals.requireLearnerRead(authentication);
        List<Map<String, Object>> rows = bankRows();
        List<Map<String, Object>> items = sealedItems(rows);
        long contentVersionId = contentVersion(rows);
        String scoringVersion = scoringVersion(rows);
        long contentEpoch = contentEpoch();
        String snapshotId = "snap_p1.placement.v1-" + contentVersionId;
        String snapshotHash = sha256(canonicalItems(items));
        String ruleDigest = sha256(canonicalRules(items, scoringVersion));
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("bankCode", BANK);
        snapshot.put("contentVersionId", contentVersionId);
        snapshot.put("contentEpoch", contentEpoch);
        snapshot.put("snapshotId", snapshotId);
        snapshot.put("snapshotHash", snapshotHash);
        snapshot.put("answerRuleSetVersion", ANSWER_RULE_SET_VERSION);
        snapshot.put("answerRuleVersion", scoringVersion);
        snapshot.put("ruleDigest", ruleDigest);
        snapshot.put("contentStateVersion", contentStateVersion(contentVersionId));
        snapshot.put("items", items);
        return Map.of("data", snapshot);
    }

    /**
     * Answer-free plan task seeds for learning-service plan assembly. Only
     * identifiers and display order cross this boundary: no stems, options or
     * answer rules. The bank shape validation is shared with the sealed
     * endpoint, so a drifted bank fails closed here as well.
     */
    @GetMapping("/plan-items")
    public Map<String, Object> planItems(Authentication authentication) {
        ContentHttpPrincipals.requireLearnerRead(authentication);
        List<Map<String, Object>> rows = bankRows();
        List<Map<String, Object>> items = sealedItems(rows);
        long contentVersionId = contentVersion(rows);
        long contentEpoch = contentEpoch();
        List<Map<String, Object>> seeds = new ArrayList<>(items.size());
        for (Map<String, Object> item : items) {
            Map<String, Object> seed = new LinkedHashMap<>();
            seed.put("itemId", item.get("itemId"));
            seed.put("itemCode", item.get("itemCode"));
            seed.put("itemType", item.get("itemType"));
            seed.put("dimension", item.get("dimension"));
            seed.put("displayOrder", item.get("displayOrder"));
            seeds.add(Map.copyOf(seed));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("bankCode", BANK);
        data.put("contentVersionId", contentVersionId);
        data.put("contentEpoch", contentEpoch);
        data.put("contentStateVersion", contentStateVersion(contentVersionId));
        data.put("items", List.copyOf(seeds));
        return Map.of("data", data);
    }

    private List<Map<String, Object>> bankRows() {
        return jdbc.queryForList("""
                SELECT placement_item_id, dimension, display_order, item_code, item_type,
                       stem, options_json, answer_rule_json, question_type, scoring_version,
                       max_score, content_version_id, content_code
                  FROM content_placement_item
                 WHERE tenant_id = ? AND bank_code = ? AND status = 'PUBLISHED'
                   AND copyright_status = 'ACTIVE' AND rights_allows_learning = TRUE
                 ORDER BY display_order, placement_item_id
                """, TENANT, BANK);
    }

    private List<Map<String, Object>> sealedItems(List<Map<String, Object>> rows) {
        if (rows.size() != 10) {
            throw unavailable("placement bank must expose exactly ten sealed items");
        }
        Map<String, Integer> required = Map.of(
                "VOCABULARY", 3, "BASIC_GRAMMAR", 3, "READING", 2, "LISTENING", 2);
        Map<String, Integer> seen = new LinkedHashMap<>();
        List<Map<String, Object>> items = new ArrayList<>(10);
        int order = 0;
        for (Map<String, Object> row : rows) {
            order++;
            String dimension = text(row.get("dimension"));
            String itemType = text(row.get("item_type"));
            if (!required.containsKey(dimension)
                    || !expectedType(dimension).equals(itemType)
                    || number(row.get("display_order"), -1) != order) {
                throw unavailable("placement bank dimension, type or order drifted");
            }
            seen.merge(dimension, 1, Integer::sum);
            long itemId = number(row.get("placement_item_id"), -1);
            String itemCode = text(row.get("item_code"));
            String stem = text(row.get("stem"));
            if (itemId < 1 || itemCode.length() < 2 || itemCode.length() > 128 || stem.isBlank()) {
                throw unavailable("placement bank item identity or stem is invalid");
            }
            List<Map<String, Object>> options = options(row.get("options_json"));
            String correctOption = answerRule(row.get("answer_rule_json"), options);
            String questionType = text(row.get("question_type"));
            if (!"CHOICE".equals(questionType)) {
                throw unavailable("placement bank question type is not objectively gradable");
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("itemId", itemId);
            item.put("itemCode", itemCode);
            item.put("itemType", itemType);
            item.put("dimension", dimension);
            item.put("displayOrder", order);
            item.put("stem", stem);
            item.put("options", options);
            item.put("questionType", questionType);
            item.put("scoringVersion", text(row.get("scoring_version")));
            item.put("maxScore", (int) number(row.get("max_score"), -1));
            item.put("contentCode", text(row.get("content_code")));
            item.put("contentVersionId", number(row.get("content_version_id"), -1));
            item.put("answerRule", Map.of("correctOption", correctOption));
            items.add(Map.copyOf(item));
        }
        if (!seen.equals(required)) {
            throw unavailable("placement bank dimension mix is not 3/3/2/2");
        }
        return List.copyOf(items);
    }

    private long contentVersion(List<Map<String, Object>> rows) {
        long version = number(rows.getFirst().get("content_version_id"), -1);
        if (version < 1 || rows.stream().anyMatch(row -> number(row.get("content_version_id"), -1) != version)) {
            throw unavailable("placement bank content version pin is not unique");
        }
        return version;
    }

    private String scoringVersion(List<Map<String, Object>> rows) {
        String version = text(rows.getFirst().get("scoring_version"));
        if (version.isBlank() || version.length() > 96
                || rows.stream().anyMatch(row -> !version.equals(text(row.get("scoring_version"))))) {
            throw unavailable("placement bank scoring version pin is not unique");
        }
        return version;
    }

    private long contentEpoch() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT content_epoch FROM content_definition WHERE content_id = ? AND tenant_id = ?",
                BANK_CONTENT_ID, TENANT);
        if (rows.isEmpty()) {
            throw unavailable("placement bank content epoch is missing");
        }
        long epoch = number(rows.getFirst().get("content_epoch"), -1);
        if (epoch < 0) {
            throw unavailable("placement bank content epoch is invalid");
        }
        return epoch;
    }

    private long contentStateVersion(long contentVersionId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT state_version FROM content_version WHERE content_version_id = ?",
                contentVersionId);
        if (rows.isEmpty()) {
            throw unavailable("placement bank content version is missing");
        }
        long stateVersion = number(rows.getFirst().get("state_version"), -1);
        if (stateVersion < 1) {
            throw unavailable("placement bank content state version is invalid");
        }
        return stateVersion;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> options(Object raw) {
        Object decoded = json(raw, "placement options are invalid");
        if (!(decoded instanceof List<?> values) || values.size() < 2 || values.size() > 32) {
            throw unavailable("placement options are invalid");
        }
        List<Map<String, Object>> options = new ArrayList<>();
        java.util.Set<String> ids = new java.util.HashSet<>();
        for (Object entry : values) {
            if (!(entry instanceof Map<?, ?> option) || option.size() != 2
                    || !(option.get("optionId") instanceof String optionId)
                    || !(option.get("label") instanceof String label)
                    || optionId.isBlank() || optionId.length() > 64
                    || label.isBlank() || label.length() > 512
                    || !ids.add(optionId)) {
                throw unavailable("placement option is invalid");
            }
            options.add(Map.of("optionId", optionId, "label", label));
        }
        return List.copyOf(options);
    }

    private String answerRule(Object raw, List<Map<String, Object>> options) {
        Object decoded = json(raw, "placement answer rule is invalid");
        if (!(decoded instanceof Map<?, ?> rule)
                || !(rule.get("correctOption") instanceof String correct)
                || correct.isBlank() || correct.length() > 64
                || options.stream().noneMatch(option -> correct.equals(option.get("optionId")))) {
            // The correct option must name a served option: unanswerable or
            // leaked-by-shape banks never leave this boundary.
            throw unavailable("placement answer rule does not resolve to a served option");
        }
        return correct;
    }

    private Object json(Object raw, String message) {
        if (!(raw instanceof String json) || json.isBlank()) {
            throw unavailable(message);
        }
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (Exception invalid) {
            throw unavailable(message);
        }
    }

    private static String expectedType(String dimension) {
        return switch (dimension) {
            case "VOCABULARY" -> "VOCABULARY";
            case "BASIC_GRAMMAR" -> "GRAMMAR";
            case "READING" -> "READING";
            case "LISTENING" -> "LISTENING";
            default -> "";
        };
    }

    private static String canonicalItems(List<Map<String, Object>> items) {
        StringBuilder canonical = new StringBuilder(BANK).append('|');
        for (Map<String, Object> item : items) {
            canonical.append(item.get("itemId")).append(':').append(item.get("itemCode"))
                    .append(':').append(item.get("dimension")).append(':').append(item.get("displayOrder"))
                    .append(':').append(item.get("stem")).append(':').append(item.get("options"))
                    .append(':').append(item.get("questionType")).append(':').append(item.get("scoringVersion"))
                    .append(':').append(item.get("maxScore")).append(':').append(item.get("contentCode"))
                    .append(':').append(item.get("contentVersionId")).append('|');
        }
        return canonical.toString();
    }

    private static String canonicalRules(List<Map<String, Object>> items, String scoringVersion) {
        StringBuilder canonical = new StringBuilder(scoringVersion).append('|');
        for (Map<String, Object> item : items) {
            @SuppressWarnings("unchecked")
            Map<String, Object> rule = (Map<String, Object>) item.get("answerRule");
            canonical.append(item.get("itemId")).append(':').append(rule.get("correctOption")).append('|');
        }
        return canonical.toString();
    }

    private static long number(Object value, long fallback) {
        return value instanceof Number number ? number.longValue() : fallback;
    }

    private static String text(Object value) {
        return value instanceof String string ? string : "";
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
