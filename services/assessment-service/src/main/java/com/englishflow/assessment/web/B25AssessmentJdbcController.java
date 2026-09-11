package com.englishflow.assessment.web;

import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** B25 placement adapter. Scoring is derived from the private assessment projection, not the client. */
@RestController
@RequestMapping("/internal/v1/assessment")
@ConditionalOnProperty(prefix = "assessment.persistence", name = "enabled", havingValue = "true")
public class B25AssessmentJdbcController {
    private static final String TENANT = "platform";
    private static final String DEFAULT_CONTENT = "course-b25-basics";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public B25AssessmentJdbcController(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /**
     * B2 daily stream compatibility read.  The session and its content pin are
     * durable assessment facts; the client only receives learner-safe options.
     */
    @GetMapping("/daily-stream")
    public Map<String, Object> dailyStream(Authentication authentication,
            @RequestParam(required = false) String date,
            @RequestParam(defaultValue = "15") int targetCount) {
        Principal principal = principal(authentication);
        String localDate = date == null || date.isBlank() ? LocalDate.now().toString() : date;
        int boundedTarget = Math.max(1, Math.min(targetCount, 20));
        String key = "b2-daily-stream:" + localDate + ":" + boundedTarget;
        Map<String, Object> session = one("SELECT * FROM b25_assessment_session WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?", TENANT, principal.subject(), key);
        if (session == null) {
            List<Map<String, Object>> rules = jdbc.queryForList("""
                    SELECT * FROM b25_assessment_item_rule
                     WHERE content_code = ? AND active = TRUE
                     ORDER BY item_id LIMIT ?
                    """, DEFAULT_CONTENT, boundedTarget);
            if (rules.isEmpty()) throw new ResponseStatusException(HttpStatus.GONE, "assessment content is unavailable");
            String sessionId = UUID.randomUUID().toString();
            jdbc.update("""
                    INSERT INTO b25_assessment_session
                        (session_id, principal_id, tenant_id, content_code, status, answers_json, idempotency_key)
                    VALUES (?, ?, ?, ?, 'IN_PROGRESS', '{}', ?)
                    """, sessionId, principal.subject(), TENANT, DEFAULT_CONTENT, key);
            session = one("SELECT * FROM b25_assessment_session WHERE session_id = ?", sessionId);
        }
        List<Map<String, Object>> rules = jdbc.queryForList("""
                SELECT * FROM b25_assessment_item_rule
                 WHERE content_code = ? AND active = TRUE
                 ORDER BY item_id LIMIT ?
                """, session.get("content_code"), boundedTarget);
        List<Map<String, Object>> exercises = rules.stream().map(this::dailyExercise).toList();
        Map<String, Object> result = new LinkedHashMap<>(sessionView(session));
        result.put("sessionType", "DAILY_STREAM");
        result.put("date", localDate);
        result.put("targetCount", boundedTarget);
        result.put("serverNow", Instant.now().toString());
        result.put("exercises", exercises);
        result.put("items", exercises);
        result.put("source", "mysql");
        return result;
    }

    @PostMapping("/placement/start")
    @Transactional
    public Map<String, Object> start(Authentication authentication, @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication);
        requireKey(idempotencyKey);
        String contentCode = text(body == null ? null : body.get("contentCode"), DEFAULT_CONTENT);
        Map<String, Object> session = one("SELECT * FROM b25_assessment_session WHERE principal_id = ? AND tenant_id = ? AND idempotency_key = ?", principal.subject(), TENANT, idempotencyKey);
        if (session == null) {
            Map<String, Object> rule = firstRule(contentCode);
            if (rule == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment content is unavailable");
            String sessionId = UUID.randomUUID().toString();
            jdbc.update("INSERT INTO b25_assessment_session (session_id, principal_id, tenant_id, content_code, status, answers_json, idempotency_key) VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, ?)", sessionId, principal.subject(), TENANT, contentCode, "{}", idempotencyKey);
            session = one("SELECT * FROM b25_assessment_session WHERE session_id = ?", sessionId);
        }
        return sessionView(session);
    }

    @GetMapping("/placement/start")
    public Map<String, Object> readPlacement(Authentication authentication,
            @RequestParam(required = false) String sessionId) {
        Principal principal = principal(authentication);
        Map<String, Object> session = sessionId == null || sessionId.isBlank()
                ? one("SELECT * FROM b25_assessment_session WHERE principal_id = ? AND tenant_id = ? ORDER BY updated_at DESC LIMIT 1", principal.subject(), TENANT)
                : one("SELECT * FROM b25_assessment_session WHERE session_id = ? AND principal_id = ? AND tenant_id = ?", sessionId, principal.subject(), TENANT);
        return session == null ? Map.of("status", "EMPTY", "contentLocale", "en-US") : sessionView(session);
    }

    @PostMapping("/placement/submit-step")
    @Transactional
    public Map<String, Object> submitStep(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication);
        requireKey(idempotencyKey);
        String sessionId = text(body.get("sessionId"), "");
        String questionId = text(body.get("questionId"), "");
        String selectedKey = text(body.get("selectedKey"), "");
        if (sessionId.isBlank() || questionId.isBlank() || selectedKey.isBlank()) bad("sessionId, questionId and selectedKey are required");
        String requestDigest = sha256(String.join("\u0000", sessionId, questionId, selectedKey));
        if (!claimOnce(principal.subject(), idempotencyKey, "PLACEMENT_ANSWER", requestDigest)) {
            Map<String, Object> session = ownerSession(sessionId, principal.subject());
            return sessionView(session);
        }
        Map<String, Object> session = ownerSession(sessionId, principal.subject());
        if (!"IN_PROGRESS".equals(String.valueOf(session.get("status")))) return sessionView(session);
        Map<String, Object> rule = one("SELECT * FROM b25_assessment_item_rule WHERE item_id = ? AND content_code = ? AND active = TRUE", questionId, session.get("content_code"));
        if (rule == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment question is unavailable");
        ObjectNode answers = objectAnswers(session.get("answers_json"));
        answers.put(questionId, selectedKey);
        jdbc.update("UPDATE b25_assessment_session SET answers_json = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE session_id = ? AND principal_id = ? AND tenant_id = ?", json(answers), sessionId, principal.subject(), TENANT);
        Map<String, Object> updated = ownerSession(sessionId, principal.subject());
        List<Map<String, Object>> rules = jdbc.queryForList("SELECT * FROM b25_assessment_item_rule WHERE content_code = ? AND active = TRUE ORDER BY item_id", session.get("content_code"));
        Map<String, String> answerMap = readAnswers(updated.get("answers_json"));
        if (answerMap.keySet().containsAll(rules.stream().map(row -> String.valueOf(row.get("item_id"))).toList())) {
            Map<String, Object> completed = complete(principal.subject(), updated, rules, answerMap);
            completed.put("isCorrect", isCorrect(rule.get("answer_rule_json"), selectedKey));
            completed.put("feedback", ruleFeedback(rule, selectedKey));
            return completed;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "IN_PROGRESS"); result.put("sessionId", sessionId); result.put("isCompleted", false);
        Map<String, Object> next = rules.stream().filter(row -> !answerMap.containsKey(String.valueOf(row.get("item_id")))).findFirst().orElse(null);
        result.put("currentQuestion", questionFor(next, questionIndex(rules, next), Math.max(1, rules.size())));
        result.put("isCorrect", isCorrect(rule.get("answer_rule_json"), selectedKey));
        result.put("feedback", ruleFeedback(rule, selectedKey));
        return result;
    }

    @PostMapping("/placement/skip")
    @Transactional
    public Map<String, Object> skip(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication);
        requireKey(idempotencyKey);
        String level = fastTrackCefr(body == null ? null : body.get("fastTrackLevel"));
        if (!List.of("A1", "A2", "B1", "B2", "C1", "C2").contains(level)) bad("unsupported fastTrackLevel");
        if (!claimOnce(principal.subject(), idempotencyKey, "PLACEMENT_SKIP", sha256(level))) {
            Map<String, Object> existing = one("SELECT * FROM b25_assessment_session WHERE principal_id = ? AND tenant_id = ? ORDER BY updated_at DESC LIMIT 1", principal.subject(), TENANT);
            return existing == null ? Map.of("status", "SKIPPED", "isCompleted", true) : sessionView(existing);
        }
        String sessionId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO b25_assessment_session (session_id, principal_id, tenant_id, content_code, status, answers_json, idempotency_key, score) VALUES (?, ?, ?, ?, 'SKIPPED', '{}', ?, 0)", sessionId, principal.subject(), TENANT, DEFAULT_CONTENT, idempotencyKey, idempotencyKey);
        String reportId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO b25_assessment_report (report_id, session_id, principal_id, tenant_id, cefr_level, score, radar_json, mistakes_json) VALUES (?, ?, ?, ?, ?, 0, ?, ?)", reportId, sessionId, principal.subject(), TENANT, level, "{}", "[]");
        jdbc.update("UPDATE b25_assessment_session SET report_id = ? WHERE session_id = ?", reportId, sessionId);
        return reportView(one("SELECT * FROM b25_assessment_report WHERE report_id = ?", reportId));
    }

    @GetMapping("/placement/report/{sessionId}")
    public Map<String, Object> report(Authentication authentication, @PathVariable String sessionId) {
        Principal principal = principal(authentication);
        Map<String, Object> session = ownerSession(sessionId, principal.subject());
        String reportId = text(session.get("report_id"), "");
        if (reportId.isBlank()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment report is not ready");
        return reportView(one("SELECT * FROM b25_assessment_report WHERE report_id = ? AND principal_id = ? AND tenant_id = ?", reportId, principal.subject(), TENANT));
    }

    private Map<String, Object> complete(String subject, Map<String, Object> session, List<Map<String, Object>> rules, Map<String, String> answers) {
        int correct = 0;
        List<String> mistakes = new ArrayList<>();
        for (Map<String, Object> rule : rules) {
            String itemId = String.valueOf(rule.get("item_id"));
            if (isCorrect(rule.get("answer_rule_json"), answers.get(itemId))) correct++; else mistakes.add(itemId);
        }
        double score = rules.isEmpty() ? 0 : ((double) correct / rules.size());
        String level = level(score);
        String reportId = UUID.randomUUID().toString();
        String mistakesJson = json(mistakes);
        jdbc.update("INSERT INTO b25_assessment_report (report_id, session_id, principal_id, tenant_id, cefr_level, score, radar_json, mistakes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", reportId, session.get("session_id"), subject, TENANT, level, score, json(Map.of("overall", score, "accuracy", score)), mistakesJson);
        jdbc.update("UPDATE b25_assessment_session SET status = 'COMPLETED', score = ?, report_id = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE session_id = ? AND principal_id = ? AND tenant_id = ?", score, reportId, session.get("session_id"), subject, TENANT);
        Map<String, Object> result = new LinkedHashMap<>(reportView(one("SELECT * FROM b25_assessment_report WHERE report_id = ?", reportId)));
        result.put("isCompleted", true); result.put("nextQuestion", null); result.put("status", "COMPLETED"); result.put("sessionId", session.get("session_id"));
        return result;
    }

    private Map<String, Object> sessionView(Map<String, Object> session) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", session.get("status")); result.put("sessionId", session.get("session_id"));
        result.put("contentVersionId", session.get("content_code"));
        String reportId = text(session.get("report_id"), "");
        if (!reportId.isBlank()) {
            result.put("report", reportView(one("SELECT * FROM b25_assessment_report WHERE report_id = ?", reportId)));
            result.put("isCompleted", true); return result;
        }
        Map<String, String> answers = readAnswers(session.get("answers_json"));
        List<Map<String, Object>> rules = jdbc.queryForList("SELECT * FROM b25_assessment_item_rule WHERE content_code = ? AND active = TRUE ORDER BY item_id", session.get("content_code"));
        Map<String, Object> next = rules.stream().filter(row -> !answers.containsKey(String.valueOf(row.get("item_id")))).findFirst().orElse(null);
        int nextStep = questionIndex(rules, next);
        result.put("currentQuestion", questionFor(next, nextStep, Math.max(1, rules.size())));
        result.put("nextQuestion", questionFor(next, nextStep, Math.max(1, rules.size()))); result.put("isCompleted", false);
        return result;
    }

    private Map<String, Object> questionFor(Map<String, Object> row) {
        return questionFor(row, 1, 1);
    }

    private Map<String, Object> questionFor(Map<String, Object> row, int stepIndex, int totalSteps) {
        if (row == null) return null;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("questionId", row.get("item_id")); result.put("stemText", row.get("prompt")); result.put("prompt", row.get("prompt"));
        result.put("options", parseJson(row.get("options_json"), List.of())); result.put("dimension", row.get("dimension"));
        result.put("difficulty", number(row.get("difficulty"))); result.put("timeLimitSec", 25);
        result.put("stepIndex", Math.max(1, stepIndex)); result.put("totalSteps", Math.max(1, totalSteps));
        return result;
    }

    private Map<String, Object> dailyExercise(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>(questionFor(row));
        result.put("id", row.get("item_id"));
        result.put("itemId", row.get("item_id"));
        result.put("type", "CHOICE");
        result.put("position", 1);
        result.put("feedbackPolicy", "IMMEDIATE");
        result.put("contentVersionId", row.get("content_version_id"));
        return result;
    }

    private Map<String, Object> reportView(Map<String, Object> row) {
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment report is not ready");
        double score = ((Number) row.get("score")).doubleValue();
        String cefrLevel = text(row.get("cefr_level"), "A1");
        Map<String, Object> result = new LinkedHashMap<>(); result.put("reportId", row.get("report_id")); result.put("sessionId", row.get("session_id"));
        result.put("cefrLevel", cefrLevel); result.put("score", score);
        result.put("estimatedVocabulary", estimatedVocabulary(cefrLevel));
        result.put("recommendedAdvice", recommendedAdvice(cefrLevel));
        result.put("radarScores", radarView(parseJson(row.get("radar_json"), Map.of()), score)); result.put("mistakes", parseJson(row.get("mistakes_json"), List.of()));
        result.put("source", "PLACEMENT"); result.put("completedAt", row.get("created_at")); return result;
    }

    private static int questionIndex(List<Map<String, Object>> rules, Map<String, Object> row) {
        if (row == null) return Math.max(1, rules.size());
        String itemId = String.valueOf(row.get("item_id"));
        for (int index = 0; index < rules.size(); index++) {
            if (itemId.equals(String.valueOf(rules.get(index).get("item_id")))) return index + 1;
        }
        return 1;
    }

    private static String fastTrackCefr(Object value) {
        String raw = text(value, "A1").toUpperCase(java.util.Locale.ROOT);
        return switch (raw) {
            case "ZERO_A1" -> "A1";
            case "CET4_B1" -> "B1";
            case "CET6_B2", "POSTGRAD_B2_PLUS" -> "B2";
            default -> raw;
        };
    }

    private static Map<String, Object> radarView(Object raw, double score) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (raw instanceof Map<?, ?> values) {
            for (Map.Entry<?, ?> entry : values.entrySet()) {
                if (entry.getKey() instanceof String key) result.put(key, entry.getValue());
            }
        }
        int percent = (int) Math.round(score * 100);
        for (String key : List.of("vocab", "grammar", "listening", "speed", "scenario")) result.putIfAbsent(key, percent);
        return result;
    }

    private static int estimatedVocabulary(String cefrLevel) {
        return switch (cefrLevel) {
            case "A2" -> 1500;
            case "B1" -> 3200;
            case "B2" -> 5000;
            case "C1" -> 7000;
            case "C2" -> 9000;
            default -> 700;
        };
    }

    private static String recommendedAdvice(String cefrLevel) {
        return switch (cefrLevel) {
            case "A1", "A2" -> "先巩固核心词汇、发音和高频短句，再逐步增加听力输入。";
            case "B1" -> "围绕高频词汇和听力精听推进，并用错题复习确认薄弱点。";
            case "B2" -> "保持阅读与听力输入，重点复盘复杂句和表达准确度。";
            default -> "保持稳定输入与间隔复习，优先修复报告中的薄弱点。";
        };
    }

    private Map<String, Object> firstRule(String contentCode) { return one("SELECT * FROM b25_assessment_item_rule WHERE content_code = ? AND active = TRUE ORDER BY item_id LIMIT 1", contentCode); }
    private Map<String, Object> ownerSession(String sessionId, String subject) {
        Map<String, Object> row = one("SELECT * FROM b25_assessment_session WHERE session_id = ? AND principal_id = ? AND tenant_id = ?", sessionId, subject, TENANT);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment session not found"); return row;
    }
    private boolean claimOnce(String subject, String key, String operation, String requestDigest) {
        String operationCode = operation + ":" + requestDigest;
        int inserted = jdbc.update("INSERT IGNORE INTO b25_assessment_idempotency (principal_id, tenant_id, idempotency_key, operation_code) VALUES (?, ?, ?, ?)", subject, TENANT, key, operationCode);
        if (inserted > 0) return true;
        String existing = String.valueOf(oneValue("SELECT operation_code FROM b25_assessment_idempotency WHERE principal_id = ? AND tenant_id = ? AND idempotency_key = ?", subject, TENANT, key));
        if (existing.equals(operation) || existing.equals(operationCode)) return false;
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was reused with a different assessment request");
    }
    private Map<String, Object> ruleFeedback(Map<String, Object> rule, String selectedKey) {
        boolean correct = isCorrect(rule.get("answer_rule_json"), selectedKey);
        Map<String, Object> feedback = new LinkedHashMap<>();
        feedback.put("status", correct ? "CORRECT" : "INCORRECT");
        feedback.put("code", correct ? "RULE_MATCH" : "RULE_REVIEW");
        feedback.put("message", correct ? "服务端规则判定：回答正确。" : "服务端规则判定：需要复习。");
        feedback.put("source", "assessment-service");
        feedback.put("ruleVersion", text(rule.get("rule_version"), "B25-RULES-2026-08-26"));
        return feedback;
    }
    private ObjectNode objectAnswers(Object raw) { try { return raw == null ? mapper.createObjectNode() : (ObjectNode) mapper.readTree(String.valueOf(raw)); } catch (Exception e) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment state is invalid"); } }
    private Map<String, String> readAnswers(Object raw) { try { return mapper.readValue(String.valueOf(raw == null ? "{}" : raw), new TypeReference<Map<String, String>>() {}); } catch (Exception e) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment state is invalid"); } }
    private boolean isCorrect(Object rawRule, String selected) { if (selected == null) return false; try { JsonNode rule = mapper.readTree(String.valueOf(rawRule)); JsonNode accepted = rule.get("acceptedKeys"); if (accepted != null && accepted.isArray()) for (JsonNode item : accepted) if (selected.equals(item.asText())) return true; return selected.equals(rule.path("answer").asText()) || selected.equals(rule.path("correctKey").asText()); } catch (Exception e) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment answer rule is invalid"); } }
    private Object parseJson(Object raw, Object fallback) { try { return mapper.readValue(String.valueOf(raw), Object.class); } catch (Exception e) { return fallback; } }
    private String json(Object value) { try { return mapper.writeValueAsString(value); } catch (JacksonException e) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment state cannot be serialized"); } }
    private static String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    private static String level(double score) { return score < .40 ? "A1" : score < .60 ? "A2" : score < .75 ? "B1" : score < .85 ? "B2" : score < .93 ? "C1" : "C2"; }
    private static String text(Object value, String fallback) { return value instanceof String s && !s.isBlank() ? s.trim() : fallback; }
    private static int number(Object value) { return value instanceof Number n ? n.intValue() : 0; }
    private static void requireKey(String key) { if (key == null || key.isBlank() || key.length() > 192) bad("Idempotency-Key is required"); }
    private static void bad(String message) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private Map<String, Object> one(String sql, Object... args) { List<Map<String, Object>> rows = jdbc.queryForList(sql, args); return rows.isEmpty() ? null : rows.get(0); }
    private Object oneValue(String sql, Object... args) { Map<String, Object> row = one(sql, args); return row == null ? null : row.values().stream().findFirst().orElse(null); }
    private Principal principal(Authentication authentication) { return new Principal(AssessmentHttpPrincipals.require(authentication).subject()); }
    private record Principal(String subject) {}
}
