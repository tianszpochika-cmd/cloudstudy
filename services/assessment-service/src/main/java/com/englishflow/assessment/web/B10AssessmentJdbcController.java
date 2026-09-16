package com.englishflow.assessment.web;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * B10 canonical assessment adapter backed only by assessment-service tables.
 * The controller intentionally exposes learner-safe content items and keeps
 * answer rules inside this service boundary.
 */
@RestController
@RequestMapping("/internal/v1/assessment")
@ConditionalOnProperty(prefix = "assessment.persistence", name = "enabled", havingValue = "true")
public class B10AssessmentJdbcController {
    private static final String TENANT = "platform";
    private static final String CONTENT_CODE = "course-b25-basics";
    private static final long DEFAULT_CONTENT_VERSION = 25001L;
    private static final long CONTENT_EPOCH = 1L;
    private static final long SNAPSHOT_ID = 25001L;
    private static final String SNAPSHOT_HASH = "0000000000000000000000000000000000000000000000000000000000000001";

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public B10AssessmentJdbcController(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @PostMapping("/sessions")
    @Transactional
    public Map<String, Object> createSession(
            Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication);
        requireKey(idempotencyKey);
        long contentVersionId = positiveLong(body.get("contentVersionId"), DEFAULT_CONTENT_VERSION);
        String mode = upperText(body.get("mode"), "PRACTICE");
        if (!List.of("PRACTICE", "REVIEW", "PLACEMENT", "MOCK").contains(mode)) {
            bad("unsupported assessment mode");
        }
        Map<String, Object> existing = one("""
                SELECT * FROM b10_assessment_session
                 WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                """, TENANT, principal.subject(), idempotencyKey);
        if (existing != null) return envelope(sessionView(existing));

        List<Map<String, Object>> rules = rules(contentVersionId, body.get("itemIds"));
        if (rules.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.GONE, "assessment content is unavailable");
        }
        String sessionId = "asess_" + compactUuid();
        List<Map<String, Object>> items = rules.stream().map(this::learnerItem).toList();
        jdbc.update("""
                INSERT INTO b10_assessment_session
                    (session_id, principal_id, tenant_id, mode, status, content_code,
                     content_version_id, content_epoch, snapshot_id, snapshot_hash,
                     items_json, answers_json, state_version, attempt_count,
                     idempotency_key, started_at)
                VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?, ?, ?, '{}', 1, 0, ?, CURRENT_TIMESTAMP(6))
                """, sessionId, principal.subject(), TENANT, mode, CONTENT_CODE,
                contentVersionId, CONTENT_EPOCH, SNAPSHOT_ID, SNAPSHOT_HASH,
                json(items), idempotencyKey);
        return envelope(sessionView(one("SELECT * FROM b10_assessment_session WHERE session_id = ?", sessionId)));
    }

    @GetMapping("/sessions/{sessionId}")
    public Map<String, Object> readSession(Authentication authentication, @PathVariable String sessionId) {
        Principal principal = principal(authentication);
        return envelope(sessionView(ownerSession(sessionId, principal.subject())));
    }

    @PostMapping("/sessions/{sessionId}/attempts")
    @Transactional
    public Map<String, Object> submitAttempt(
            Authentication authentication,
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication);
        requireKey(idempotencyKey);
        Map<String, Object> session = ownerSession(sessionId, principal.subject());
        String submissionId = text(body.get("submissionId"));
        if (submissionId.isBlank()) bad("submissionId is required");
        List<Map<String, Object>> submissions = objectList(body.get("items"));
        if (submissions.isEmpty()) bad("items is required");
        String requestDigest = sha256(json(body));
        Map<String, Object> idempotentAttempt = claimAttemptIdempotency(principal.subject(), idempotencyKey, requestDigest);
        if (idempotentAttempt != null) return envelope(attemptView(idempotentAttempt));
        Map<String, Object> duplicate = one("""
                SELECT * FROM b10_assessment_attempt
                 WHERE session_id = ? AND submission_id = ? AND principal_id = ?
                """, sessionId, submissionId, principal.subject());
        if (duplicate != null) {
            if (!sha256(json(submissions)).equals(text(duplicate.get("submission_digest")))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "submissionId was reused with a different answer");
            }
            Map<String, Object> view = attemptView(duplicate);
            saveAttemptIdempotency(principal.subject(), idempotencyKey, requestDigest, text(duplicate.get("attempt_id")));
            return envelope(view);
        }
        long expectedStateVersion = positiveLong(body.get("expectedStateVersion"), 1L);
        long stateVersion = longValue(session.get("state_version"), 1L);
        if (expectedStateVersion != stateVersion) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "assessment state version is stale");
        }
        List<Map<String, Object>> rules = rules(longValue(session.get("content_version_id"), DEFAULT_CONTENT_VERSION), null);
        Map<Long, Map<String, Object>> ruleById = new LinkedHashMap<>();
        for (Map<String, Object> rule : rules) ruleById.put(numericItemId(text(rule.get("item_id"))), rule);
        ObjectNode answers = objectAnswers(session.get("answers_json"));
        int correct = 0;
        int scored = 0;
        List<String> mistakes = new ArrayList<>();
        for (Map<String, Object> submission : submissions) {
            // P1-LIVE-010: FNV-64 itemIds exceed the JS safe-integer range, so web
            // clients cannot echo them back exactly. Accept the stable string
            // itemCode as well (same dual-matching idiom as the rules filter).
            long itemId = positiveLong(submission.get("itemId"), 0L);
            Map<String, Object> rule = ruleById.get(itemId);
            String itemCode = text(submission.get("itemCode"), "");
            if (rule == null && !itemCode.isBlank()) {
                for (Map<String, Object> candidate : rules) {
                    if (text(candidate.get("item_id")).equals(itemCode)) {
                        rule = candidate;
                        itemId = numericItemId(itemCode);
                        break;
                    }
                }
            }
            if (rule == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment item is unavailable");
            String selected = answerValue(submission.get("response"));
            answers.put(String.valueOf(itemId), selected);
            scored++;
            if (isCorrect(rule.get("answer_rule_json"), selected)) correct++;
            else mistakes.add(text(rule.get("item_id")));
        }
        String submissionDigest = sha256(json(submissions));
        int attemptVersion = (int) number(oneValue("SELECT COALESCE(MAX(attempt_version), 0) + 1 FROM b10_assessment_attempt WHERE session_id = ?", sessionId));
        String attemptId = "aatm_" + compactUuid();
        String scoreBucket = correct == scored ? "FULL" : correct == 0 ? "ZERO" : "PARTIAL";
        String reportId = "rpt_" + compactUuid();
        Map<String, String> answerMap = readAnswers(answers);
        List<String> allMistakes = rules.stream()
                .filter(rule -> !isCorrect(rule.get("answer_rule_json"), answerMap.get(String.valueOf(numericItemId(text(rule.get("item_id")))))))
                .map(rule -> text(rule.get("item_id"))).toList();
        int total = rules.size();
        int totalCorrect = total - allMistakes.size();
        String totalScoreBucket = totalCorrect == total ? "FULL" : totalCorrect == 0 ? "ZERO" : "PARTIAL";
        jdbc.update("""
                INSERT INTO b10_assessment_attempt
                    (attempt_id, session_id, principal_id, tenant_id, attempt_version,
                     submission_id, status, item_count, submission_digest, score_bucket,
                     mistake_codes_json, report_id)
                VALUES (?, ?, ?, ?, ?, ?, 'ASSESSED', ?, ?, ?, ?, ?)
                """, attemptId, sessionId, principal.subject(), TENANT, attemptVersion,
                submissionId, scored, submissionDigest, scoreBucket, json(allMistakes), reportId);
        Map<String, Object> sessionForPin = session;
        jdbc.update("""
                INSERT INTO b10_assessment_report
                    (report_id, attempt_id, session_id, principal_id, tenant_id,
                     report_version, status, score_bucket, mistake_codes_json,
                     mastery_signal, pin_json, generated_at)
                VALUES (?, ?, ?, ?, ?, 1, 'READY', ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                """, reportId, attemptId, sessionId, principal.subject(), TENANT,
                totalScoreBucket, json(allMistakes), allMistakes.isEmpty() ? "MASTERED" : "RETRY",
                json(pin(sessionForPin)));
        String nextStatus = allMistakes.isEmpty() || answerMap.size() >= total ? "ASSESSED" : "IN_PROGRESS";
        jdbc.update("""
                UPDATE b10_assessment_session
                   SET answers_json = ?, state_version = state_version + 1,
                       attempt_count = attempt_count + 1, last_attempt_id = ?, last_report_id = ?, status = ?,
                       updated_at = CURRENT_TIMESTAMP(6)
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ?
                """, json(answers), attemptId, reportId, nextStatus, sessionId, principal.subject(), TENANT);
        Map<String, Object> view = attemptView(one("SELECT * FROM b10_assessment_attempt WHERE attempt_id = ?", attemptId));
        saveAttemptIdempotency(principal.subject(), idempotencyKey, requestDigest, attemptId);
        return envelope(view);
    }

    @PutMapping("/sessions/{sessionId}/attempts/{attemptId}/checkpoint")
    @Transactional
    public Map<String, Object> saveCheckpoint(
            Authentication authentication,
            @PathVariable String sessionId,
            @PathVariable String attemptId,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication);
        requireKey(idempotencyKey);
        ownerSession(sessionId, principal.subject());
        Map<String, Object> attempt = one("""
                SELECT * FROM b10_assessment_attempt
                 WHERE attempt_id = ? AND session_id = ? AND principal_id = ? AND tenant_id = ?
                """, attemptId, sessionId, principal.subject(), TENANT);
        if (attempt == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment attempt not found");
        long version = positiveLong(body.get("checkpointVersion"), 1L);
        int cursor = (int) Math.max(0L, longValue(body.get("itemCursor"), 0L));
        String digest = text(body.get("checkpointDigest"));
        if (digest.isBlank()) bad("checkpointDigest is required");
        List<Object> completed = valueList(body.get("completedItemIds"));
        jdbc.update("""
                INSERT INTO b10_assessment_checkpoint
                    (attempt_id, session_id, principal_id, tenant_id, checkpoint_version,
                     item_cursor, completed_item_ids_json, checkpoint_digest, saved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE checkpoint_digest = VALUES(checkpoint_digest),
                    item_cursor = VALUES(item_cursor), completed_item_ids_json = VALUES(completed_item_ids_json)
                """, attemptId, sessionId, principal.subject(), TENANT, version,
                cursor, json(completed), digest);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("attemptId", attemptId);
        data.put("checkpointVersion", version);
        data.put("itemCursor", cursor);
        data.put("checkpointDigest", digest);
        data.put("savedAt", Instant.now().toString());
        return envelope(data);
    }

    @GetMapping("/reports/{reportId}")
    public Map<String, Object> readReport(Authentication authentication, @PathVariable String reportId) {
        Principal principal = principal(authentication);
        Map<String, Object> row = one("""
                SELECT * FROM b10_assessment_report
                 WHERE report_id = ? AND principal_id = ? AND tenant_id = ?
                """, reportId, principal.subject(), TENANT);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment report not found");
        return envelope(reportView(row));
    }

    private Map<String, Object> sessionView(Map<String, Object> row) {
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment session not found");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("sessionId", row.get("session_id"));
        data.put("status", row.get("status"));
        data.put("mode", row.get("mode"));
        data.put("pin", pin(row));
        data.put("items", parseJson(row.get("items_json"), List.of()));
        data.put("attemptCount", number(row.get("attempt_count")));
        data.put("stateVersion", number(row.get("state_version")));
        String lastAttemptId = text(row.get("last_attempt_id"));
        data.put("lastAttemptId", lastAttemptId.isBlank() ? null : lastAttemptId);
        data.put("startedAt", timestamp(row.get("started_at")));
        data.put("expiresAt", timestamp(row.get("expires_at")));
        String reportId = text(row.get("last_report_id"));
        if (!reportId.isBlank()) data.put("reportId", reportId);
        return data;
    }

    private Map<String, Object> attemptView(Map<String, Object> row) {
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment attempt not found");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("attemptId", row.get("attempt_id"));
        data.put("sessionId", row.get("session_id"));
        data.put("attemptVersion", number(row.get("attempt_version")));
        data.put("status", row.get("status"));
        data.put("itemCount", number(row.get("item_count")));
        data.put("submissionDigest", row.get("submission_digest"));
        data.put("scoreBucket", row.get("score_bucket"));
        data.put("pin", pin(one("SELECT * FROM b10_assessment_session WHERE session_id = ?", row.get("session_id"))));
        data.put("assessmentVersion", "B10_RULES_2026_08_26");
        data.put("createdAt", timestamp(row.get("created_at")));
        data.put("assessedAt", timestamp(row.get("created_at")));
        String reportId = text(row.get("report_id"));
        if (!reportId.isBlank()) data.put("reportId", reportId);
        return data;
    }

    private Map<String, Object> reportView(Map<String, Object> row) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("reportId", row.get("report_id"));
        data.put("attemptId", row.get("attempt_id"));
        data.put("reportVersion", number(row.get("report_version")));
        data.put("status", row.get("status"));
        data.put("scoreBucket", row.get("score_bucket"));
        data.put("mistakeCodes", parseJson(row.get("mistake_codes_json"), List.of()));
        data.put("masterySignal", row.get("mastery_signal"));
        data.put("pin", parseJson(row.get("pin_json"), Map.of()));
        data.put("generatedAt", timestamp(row.get("generated_at")));
        data.put("replayable", true);
        return data;
    }

    private List<Map<String, Object>> rules(long contentVersionId, Object requestedItemIds) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT item_id, content_version_id, prompt, options_json, dimension,
                       difficulty, answer_rule_json
                  FROM b25_assessment_item_rule
                 WHERE content_code = ? AND content_version_id = ? AND active = TRUE
                 ORDER BY item_id
                """, CONTENT_CODE, contentVersionId);
        List<Object> requested = valueList(requestedItemIds);
        if (requested.isEmpty()) return rows;
        return rows.stream().filter(row -> {
            long numeric = numericItemId(text(row.get("item_id")));
            String code = text(row.get("item_id"));
            return requested.stream().anyMatch(value -> String.valueOf(value).equals(String.valueOf(numeric)) || String.valueOf(value).equals(code));
        }).toList();
    }

    private Map<String, Object> learnerItem(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        String code = text(row.get("item_id"));
        item.put("itemId", numericItemId(code));
        item.put("itemCode", code);
        item.put("itemType", itemType(row.get("dimension")));
        item.put("stem", text(row.get("prompt")));
        item.put("options", learnerOptions(row.get("options_json")));
        item.put("displayOrder", 0);
        return item;
    }

    private List<Map<String, Object>> learnerOptions(Object raw) {
        Object value = parseJson(raw, List.of());
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(entry -> {
            @SuppressWarnings("unchecked") Map<String, Object> source = (Map<String, Object>) entry;
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("optionId", lowerText(source.get("key"), lowerText(source.get("optionId"), "option")));
            option.put("label", text(source.get("text"), text(source.get("label"))));
            return option;
        }).toList();
    }

    private Map<String, Object> pin(Map<String, Object> row) {
        Map<String, Object> pin = new LinkedHashMap<>();
        pin.put("contentCode", text(row == null ? null : row.get("content_code"), CONTENT_CODE));
        pin.put("contentVersionId", number(row == null ? null : row.get("content_version_id"), DEFAULT_CONTENT_VERSION));
        pin.put("contentEpoch", number(row == null ? null : row.get("content_epoch"), CONTENT_EPOCH));
        pin.put("snapshotId", number(row == null ? null : row.get("snapshot_id"), SNAPSHOT_ID));
        pin.put("snapshotHash", text(row == null ? null : row.get("snapshot_hash"), SNAPSHOT_HASH));
        pin.put("pinStatus", "PINNED");
        pin.put("pinnedAt", Instant.now().toString());
        return pin;
    }

    private Map<String, Object> ownerSession(String sessionId, String subject) {
        Map<String, Object> row = one("""
                SELECT * FROM b10_assessment_session
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ?
                """, sessionId, subject, TENANT);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment session not found");
        return row;
    }

    /** Claim the generic durable idempotency fact before scoring so retries do not create another attempt. */
    private Map<String, Object> claimAttemptIdempotency(String subject, String key, String requestDigest) {
        String operation = "B10_ATTEMPT_SUBMIT";
        int inserted = jdbc.update("""
                INSERT IGNORE INTO assessment_idempotency
                    (tenant_id, subject_id, operation, idempotency_key, request_digest, response_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                """, TENANT, subject, operation, key, requestDigest, json(Map.of("status", "IN_PROGRESS")));
        if (inserted > 0) return null;
        Map<String, Object> existing = one("""
                SELECT request_digest, response_json FROM assessment_idempotency
                 WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?
                """, TENANT, subject, operation, key);
        if (existing == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "assessment idempotency claim is unavailable");
        if (!requestDigest.equals(text(existing.get("request_digest")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was reused with a different assessment request");
        }
        String attemptId = storedAttemptId(existing.get("response_json"));
        if (attemptId.isBlank()) throw new ResponseStatusException(HttpStatus.CONFLICT, "assessment attempt is still being processed");
        Map<String, Object> attempt = one("""
                SELECT * FROM b10_assessment_attempt
                 WHERE attempt_id = ? AND principal_id = ? AND tenant_id = ?
                """, attemptId, subject, TENANT);
        if (attempt == null) throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment idempotency response is missing");
        return attempt;
    }

    private void saveAttemptIdempotency(String subject, String key, String requestDigest, String attemptId) {
        jdbc.update("""
                UPDATE assessment_idempotency SET request_digest = ?, response_json = ?
                 WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?
                """, requestDigest, json(Map.of("attemptId", attemptId)), TENANT, subject, "B10_ATTEMPT_SUBMIT", key);
    }

    private String storedAttemptId(Object raw) {
        try {
            JsonNode node = mapper.readTree(raw instanceof byte[] bytes ? new String(bytes, StandardCharsets.UTF_8) : String.valueOf(raw));
            return text(node.path("attemptId").asText());
        } catch (JacksonException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment idempotency response is invalid", exception);
        }
    }

    private ObjectNode objectAnswers(Object raw) {
        ObjectNode result = mapper.createObjectNode();
        Object parsed = parseJson(raw, Map.of());
        if (parsed instanceof Map<?, ?> map) {
            map.forEach((key, value) -> result.set(String.valueOf(key), mapper.valueToTree(value)));
        }
        return result;
    }

    private Map<String, String> readAnswers(ObjectNode answers) {
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<String, JsonNode> entry : answers.properties()) result.put(entry.getKey(), entry.getValue().asText(""));
        return result;
    }

    private String answerValue(Object raw) {
        if (raw instanceof Map<?, ?> map) {
            Object keys = map.get("selectedOptionKeys");
            if (keys instanceof List<?> list && !list.isEmpty()) return text(list.getFirst());
            return text(map.get("selectedOptionKey"), text(map.get("selectedKey"), text(map.get("text"))));
        }
        return text(raw);
    }

    private boolean isCorrect(Object rawRule, String selected) {
        // P1-LIVE-010: unanswered items (partial submissions) score as mistakes,
        // never NullPointerException. The caller passes null when the answer map
        // has no entry for a rule item.
        if (selected == null || selected.isBlank()) return false;
        JsonNode rule = mapper.readTree(text(rawRule, "{}"));
        JsonNode accepted = rule.get("acceptedKeys");
        if (accepted != null && accepted.isArray()) for (JsonNode item : accepted) if (selected.equals(item.asText())) return true;
        return selected.equals(rule.path("answer").asText()) || selected.equals(rule.path("correctKey").asText());
    }

    private List<Map<String, Object>> objectList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(entry -> {
            @SuppressWarnings("unchecked") Map<String, Object> row = (Map<String, Object>) entry;
            return row;
        }).toList();
    }

    private List<Object> valueList(Object value) { return value instanceof List<?> list ? new ArrayList<>(list) : List.of(); }

    private Object parseJson(Object raw, Object fallback) {
        try { return raw == null ? fallback : mapper.readValue(String.valueOf(raw), Object.class); }
        catch (JacksonException ignored) { return fallback; }
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JacksonException exception) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment state cannot be serialized", exception); }
    }

    private static String itemType(Object dimension) {
        String value = upperText(dimension, "VOCABULARY");
        return switch (value) {
            case "GRAMMAR" -> "GRAMMAR";
            case "SENTENCE" -> "SENTENCE";
            case "READING" -> "READING";
            case "LISTENING" -> "LISTENING";
            case "WRITING" -> "WRITING";
            default -> "VOCABULARY";
        };
    }

    private static long numericItemId(String code) {
        try { return Long.parseLong(code); }
        catch (NumberFormatException ignored) {
            long hash = 1469598103934665603L;
            for (byte value : code.getBytes(StandardCharsets.UTF_8)) hash = (hash ^ (value & 0xff)) * 1099511628211L;
            return hash & Long.MAX_VALUE;
        }
    }

    private static String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    private static String compactUuid() { return UUID.randomUUID().toString().replace("-", ""); }
    private static Map<String, Object> envelope(Object data) { return Map.of("data", data); }
    private static String timestamp(Object value) { return value == null ? null : value instanceof java.sql.Timestamp timestamp ? timestamp.toInstant().toString() : String.valueOf(value); }
    private static long number(Object value) { return number(value, 0L); }
    private static long number(Object value, long fallback) { return value instanceof Number number ? number.longValue() : fallback; }
    private static long longValue(Object value, long fallback) { try { return value == null ? fallback : Long.parseLong(String.valueOf(value)); } catch (NumberFormatException ignored) { return fallback; } }
    private static long positiveLong(Object value, long fallback) { long result = longValue(value, fallback); if (result <= 0) bad("positive numeric value is required"); return result; }
    private static int number(Object value, int fallback) { return (int) number(value, (long) fallback); }
    private static String text(Object value) { return text(value, ""); }
    private static String text(Object value, String fallback) { return value == null ? fallback : String.valueOf(value).trim().isBlank() ? fallback : String.valueOf(value).trim(); }
    private static String lowerText(Object value, String fallback) { return text(value, fallback).toLowerCase(java.util.Locale.ROOT); }
    private static String upperText(Object value, String fallback) { return text(value, fallback).toUpperCase(java.util.Locale.ROOT); }
    private static void requireKey(String key) { if (key == null || key.isBlank() || key.length() > 192) bad("Idempotency-Key is required"); }
    private static void bad(String message) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }

    private Map<String, Object> one(String sql, Object... args) { List<Map<String, Object>> rows = jdbc.queryForList(sql, args); return rows.isEmpty() ? null : rows.getFirst(); }
    private Object oneValue(String sql, Object... args) { List<Map<String, Object>> rows = jdbc.queryForList(sql, args); return rows.isEmpty() ? null : rows.getFirst().values().stream().findFirst().orElse(null); }

    private Principal principal(Authentication authentication) {
        return new Principal(AssessmentHttpPrincipals.require(authentication).subject());
    }

    private record Principal(String subject) {}
}
