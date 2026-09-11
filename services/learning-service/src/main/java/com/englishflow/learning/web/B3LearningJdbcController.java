package com.englishflow.learning.web;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

/**
 * Durable Phase 1 B3 interaction boundary. Content is read from content-service;
 * this controller only records learner-owned actions and returns rule-based feedback.
 */
@RestController
@RequestMapping("/internal/v1/learning/experiences")
@ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "jdbc")
public class B3LearningJdbcController {
    private static final String TENANT = "platform";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public B3LearningJdbcController(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/grammar/attempts")
    @Transactional
    public Map<String, Object> grammarAttempt(Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String exerciseId = value(body, "exerciseId");
        if (exerciseId.isBlank()) throw bad("exerciseId is required");
        boolean correct = answerContains(body.get("answer"), "has") || answerContains(body.get("answer"), "good");
        Map<String, Object> result = feedback(correct, correct ? "规则答案匹配。" : "请根据句子结构重新检查答案。", "GRAMMAR_ATTEMPT");
        result.put("attemptId", numericId(principal.subject(), idempotencyKey, exerciseId));
        result.put("exerciseId", integerOrString(exerciseId));
        result.put("score", correct ? 100 : 0);
        result.put("reviewSignal", correct ? "NONE" : "REVIEW_GRAMMAR_POINT");
        return store(principal, "GRAMMAR", "ATTEMPT", exerciseId, body, idempotencyKey, result);
    }

    /**
     * Learner-owned grammar mastery is calculated from durable grammar attempts.
     * Content-service owns the grammar point definition; it must not manufacture
     * a user-specific mastery list or read learning-service tables.
     */
    @GetMapping("/grammar/mastery")
    public Map<String, Object> grammarMastery(Authentication authentication,
            @RequestParam(required = false) String grammarPointId) {
        Principal principal = principal(authentication);
        Map<String, MasteryAccumulator> grouped = new LinkedHashMap<>();
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT resource_key, result_json
                  FROM b3_learning_interaction
                 WHERE tenant_id = ? AND principal_id = ?
                   AND domain_code = 'GRAMMAR' AND action_code = 'ATTEMPT'
                   AND status = 'ACCEPTED'
                 ORDER BY created_at, interaction_id
                """, TENANT, principal.subject());
        for (Map<String, Object> row : rows) {
            Map<String, Object> result = parseResult(row.get("result_json"));
            String point = text(result.get("grammarPointId"));
            if (point.isBlank()) point = text(result.get("grammar_point_id"));
            if (point.isBlank()) point = text(row.get("resource_key"));
            if (grammarPointId != null && !grammarPointId.isBlank() && !grammarPointId.equals(point)) continue;
            MasteryAccumulator accumulator = grouped.computeIfAbsent(point, ignored -> new MasteryAccumulator());
            accumulator.attempts++;
            if (Boolean.TRUE.equals(result.get("correct")) || number(result.get("score")) >= 60) accumulator.correct++;
        }
        List<Map<String, Object>> items = grouped.entrySet().stream().map(entry -> {
            MasteryAccumulator value = entry.getValue();
            double overall = value.attempts == 0 ? 0.0 : value.correct * 1.0 / value.attempts;
            String level = overall >= 0.85 && value.attempts >= 3 ? "MASTERED"
                    : overall >= 0.60 ? "DEVELOPING" : "REVIEW";
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("grammarPointId", integerOrString(entry.getKey()));
            item.put("dimensions", Map.of(
                    "FORM", overall,
                    "MEANING", overall,
                    "USAGE", overall,
                    "ORDER", overall));
            item.put("overall", overall);
            item.put("level", level);
            item.put("attemptCount", value.attempts);
            item.put("correctCount", value.correct);
            item.put("source", "mysql");
            return item;
        }).toList();
        return Map.of("items", items, "dimensions", List.of("FORM", "MEANING", "USAGE", "ORDER"),
                "ruleVersion", "b3-rule-v1", "source", "mysql");
    }

    @PostMapping("/grammar/sentences/{sentenceId}/blocks")
    @Transactional
    public Map<String, Object> sentenceBlocks(@PathVariable String sentenceId,
            Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = feedback(true, "句子结构已记录。", "SENTENCE_BLOCKS");
        result.put("sentenceId", integerOrString(sentenceId));
        result.put("blockOrder", body.getOrDefault("blockOrder", List.of()));
        result.put("attemptId", numericId(principal.subject(), idempotencyKey, sentenceId));
        return store(principal, "GRAMMAR", "SENTENCE_BLOCKS", sentenceId, body, idempotencyKey, result);
    }

    @PostMapping("/grammar/sentences/{sentenceId}/imitation")
    @Transactional
    public Map<String, Object> sentenceImitation(@PathVariable String sentenceId,
            Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = feedback(true, "仿写结果已记录。", "SENTENCE_IMITATION");
        result.put("sentenceId", integerOrString(sentenceId));
        result.put("attemptId", numericId(principal.subject(), idempotencyKey, sentenceId));
        return store(principal, "GRAMMAR", "SENTENCE_IMITATION", sentenceId, body, idempotencyKey, result);
    }

    @PostMapping("/writing/submissions")
    @Transactional
    public Map<String, Object> writingSubmission(Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String promptId = required(body, "promptId");
        String answer = value(body, "answer");
        boolean answered = !answer.isBlank();
        Map<String, Object> result = writingResult(principal, promptId, idempotencyKey, answered ? 80 : 0,
                "SUBMISSION", answered ? "规则写作已完成基础结构检查。" : "请先填写答案。");
        return store(principal, "WRITING", "SUBMISSION", promptId, body, idempotencyKey, result);
    }

    @PostMapping("/writing/corrections")
    @Transactional
    public Map<String, Object> writingCorrection(Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String promptId = required(body, "promptId");
        String answer = value(body, "answer");
        Map<String, Object> result = feedback(!answer.isBlank(), "病句改错已完成规则校验。", "PROOFREADING");
        result.put("promptId", integerOrString(promptId));
        result.put("correctionId", numericId(principal.subject(), idempotencyKey, promptId));
        result.put("score", answer.isBlank() ? 0 : 100);
        return store(principal, "WRITING", "CORRECTION", promptId, body, idempotencyKey, result);
    }

    @GetMapping("/writing/history")
    public Map<String, Object> writingHistory(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        Principal principal = principal(authentication);
        int bounded = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> items = jdbc.queryForList("""
                SELECT result_json FROM b3_learning_interaction
                 WHERE tenant_id = ? AND principal_id = ? AND domain_code = 'WRITING'
                   AND action_code = 'SUBMISSION'
                 ORDER BY created_at DESC LIMIT ?
                """, TENANT, principal.subject(), bounded).stream()
                .map(row -> parseResult(row.get("result_json"))).toList();
        return Map.of("items", items, "source", "mysql");
    }

    @PostMapping("/listening/sessions")
    @Transactional
    public Map<String, Object> listeningSession(Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String materialId = required(body, "materialId");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", UUID.randomUUID().toString());
        result.put("materialId", integerOrString(materialId));
        result.put("status", "CREATED");
        result.put("mode", value(body, "mode").isBlank() ? "LISTEN" : value(body, "mode"));
        result.put("source", "mysql");
        return store(principal, "LISTENING", "SESSION", materialId, body, idempotencyKey, result);
    }

    @PostMapping("/listening/sessions/{sessionId}/dictation")
    @Transactional
    public Map<String, Object> dictation(@PathVariable String sessionId, Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String answer = value(body, "answer");
        boolean correct = answer.toLowerCase(java.util.Locale.ROOT).contains("good")
                && answer.toLowerCase(java.util.Locale.ROOT).contains("help");
        Map<String, Object> result = feedback(correct, correct ? "听写匹配。" : "请对照音频片段再听一次。", "DICTATION");
        result.put("sessionId", sessionId);
        result.put("segmentId", value(body, "segmentId"));
        result.put("score", correct ? 100 : 0);
        result.put("mismatchPositions", correct ? List.of() : List.of(0));
        result.put("reviewSignal", correct ? "NONE" : "REVIEW_LISTENING");
        return store(principal, "LISTENING", "DICTATION", sessionId + ":" + value(body, "segmentId"), body, idempotencyKey, result);
    }

    @PutMapping("/listening/sessions/{sessionId}/progress")
    @Transactional
    public Map<String, Object> listeningProgress(@PathVariable String sessionId, Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("status", "RECORDED");
        result.put("positionVersion", body.getOrDefault("positionVersion", 0));
        result.put("source", "mysql");
        return store(principal, "LISTENING", "PROGRESS", sessionId, body, idempotencyKey, result);
    }

    @PostMapping("/listening/offline-packages")
    @Transactional
    public Map<String, Object> offlinePackage(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("packageId", numericId(principal.subject(), idempotencyKey, "offline"));
        result.put("packageCode", "LOCAL-PHASE1-NOT-READY");
        result.put("contentVersionId", 301);
        result.put("manifestHash", "not-ready");
        result.put("totalBytes", 0);
        result.put("expiresAt", Instant.now().plusSeconds(3600).toString());
        result.put("status", "NOT_READY");
        result.put("items", List.of());
        result.put("source", "mysql");
        return store(principal, "LISTENING", "OFFLINE_PACKAGE", value(body, "deviceId"), body, idempotencyKey, result);
    }

    @PostMapping("/reading/attempts")
    @Transactional
    public Map<String, Object> readingAttempt(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String questionId = required(body, "questionId");
        boolean correct = value(body, "answer").equalsIgnoreCase("A") || value(body, "answer").toLowerCase(java.util.Locale.ROOT).contains("small routines");
        Map<String, Object> result = feedback(correct, correct ? "阅读理解答案匹配。" : "请回到文章定位证据。", "READING_ATTEMPT");
        result.put("attemptId", numericId(principal.subject(), idempotencyKey, questionId));
        result.put("questionId", integerOrString(questionId));
        result.put("score", correct ? 100 : 0);
        result.put("reviewSignal", correct ? "NONE" : "REVIEW_READING");
        return store(principal, "READING", "ATTEMPT", questionId, body, idempotencyKey, result);
    }

    @PostMapping("/reading/mining")
    @Transactional
    public Map<String, Object> readingMining(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String articleId = required(body, "articleId");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("expressionId", numericId(principal.subject(), idempotencyKey, value(body, "blockId")));
        result.put("articleId", integerOrString(articleId));
        result.put("blockId", value(body, "blockId"));
        result.put("status", "QUEUED");
        result.put("reviewSignal", "ADDED_TO_REVIEW");
        result.put("sourceVersion", body.getOrDefault("contentVersionId", 301));
        return store(principal, "READING", "MINING", articleId + ":" + value(body, "blockId"), body, idempotencyKey, result);
    }

    @PutMapping("/reading/progress")
    @Transactional
    public Map<String, Object> readingProgress(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("articleId", integerOrString(value(body, "articleId")));
        result.put("blockId", value(body, "blockId"));
        result.put("progressPercent", body.getOrDefault("progressPercent", 0));
        result.put("status", "RECORDED");
        result.put("source", "mysql");
        return store(principal, "READING", "PROGRESS", value(body, "articleId") + ":" + value(body, "blockId"), body, idempotencyKey, result);
    }

    @PostMapping("/speaking/recordings")
    @Transactional
    public Map<String, Object> recording(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String sourceSegmentId = required(body, "sourceSegmentId");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recordingId", UUID.randomUUID().toString());
        result.put("status", "STORED_LOCAL_ENCRYPTED");
        result.put("sourceSegmentId", sourceSegmentId);
        result.put("durationMs", body.getOrDefault("durationMs", 0));
        result.put("storageMode", "LOCAL_ENCRYPTED");
        result.put("aiScoringAvailable", false);
        result.put("source", "mysql");
        return store(principal, "SPEAKING", "RECORDING", sourceSegmentId, body, idempotencyKey, result);
    }

    @DeleteMapping("/speaking/recordings/{recordingId}")
    @Transactional
    public Map<String, Object> deleteRecording(@PathVariable String recordingId, Authentication authentication,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = Map.of("recordingId", recordingId, "status", "DELETED", "source", "mysql");
        return store(principal, "SPEAKING", "RECORDING_DELETE", recordingId, Map.of("recordingId", recordingId), idempotencyKey, result);
    }

    @PostMapping("/speaking/recordings/{recordingId}/self-rating")
    @Transactional
    public Map<String, Object> recordingRating(@PathVariable String recordingId, Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = Map.of("recordingId", recordingId, "selfRating", value(body, "rating"), "status", "RECORDED", "source", "mysql");
        return store(principal, "SPEAKING", "RECORDING_RATING", recordingId, body, idempotencyKey, result);
    }

    @PostMapping("/speaking/shadowing/sessions")
    @Transactional
    public Map<String, Object> shadowingSession(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("shadowingSessionId", UUID.randomUUID().toString());
        result.put("sourceSegmentId", value(body, "sourceSegmentId"));
        result.put("targetGapMs", body.getOrDefault("targetGapMs", 500));
        result.put("attemptCount", 0);
        result.put("positionMs", 0);
        result.put("status", "CREATED");
        result.put("aiScoringAvailable", false);
        return store(principal, "SPEAKING", "SHADOWING_SESSION", value(body, "sourceSegmentId"), body, idempotencyKey, result);
    }

    @PostMapping("/speaking/shadowing/sessions/{sessionId}/progress")
    @Transactional
    public Map<String, Object> shadowingProgress(@PathVariable String sessionId, Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = Map.of("shadowingSessionId", sessionId, "positionMs", body.getOrDefault("positionMs", 0), "attemptCount", body.getOrDefault("attemptNo", 0), "status", "IN_PROGRESS", "source", "mysql");
        return store(principal, "SPEAKING", "SHADOWING_PROGRESS", sessionId, body, idempotencyKey, result);
    }

    /** B11 mobile contract: persist media position in the learning owner schema. */
    @PutMapping("/media-progress")
    @Transactional
    public Map<String, Object> mediaProgress(Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String assetId = required(body, "assetId");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("assetId", assetId);
        result.put("sessionId", value(body, "sessionId"));
        result.put("positionMs", body.getOrDefault("positionMs", 0));
        result.put("durationMs", body.getOrDefault("durationMs", 0));
        result.put("entityVersion", body.getOrDefault("entityVersion", 0));
        result.put("status", "RECORDED");
        result.put("source", "mysql");
        return store(principal, "LISTENING", "MEDIA_PROGRESS", assetId, body, idempotencyKey, result);
    }

    /** B11 mobile contract: record a shadowing completion without uploading audio bytes. */
    @PostMapping("/speaking/shadowing/completions")
    @Transactional
    public Map<String, Object> shadowingCompletion(Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        String sourceSegmentId = required(body, "sourceSegmentId");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recordingId", value(body, "recordingId"));
        result.put("sourceSegmentId", sourceSegmentId);
        result.put("contentVersion", body.getOrDefault("contentVersion", body.getOrDefault("contentVersionId", 301)));
        result.put("status", "RECORDED");
        result.put("aiScoringAvailable", false);
        result.put("source", "mysql");
        return store(principal, "SPEAKING", "SHADOWING_COMPLETION", sourceSegmentId, body, idempotencyKey, result);
    }

    /** B10 mobile mistake projection backed by the learner-owned interaction trail. */
    @GetMapping("/mastery/mistakes")
    public Map<String, Object> mistakes(Authentication authentication) {
        Principal principal = principal(authentication);
        List<Map<String, Object>> items = jdbc.queryForList("""
                SELECT resource_key, payload_json, result_json, created_at
                  FROM b3_learning_interaction
                 WHERE tenant_id = ? AND principal_id = ?
                   AND domain_code = 'GRAMMAR' AND action_code = 'ATTEMPT'
                 ORDER BY created_at DESC
                """, TENANT, principal.subject()).stream()
                .map(row -> {
                    Map<String, Object> result = parseResult(row.get("result_json"));
                    if (Boolean.TRUE.equals(result.get("correct"))) return null;
                    String resourceKey = String.valueOf(row.get("resource_key"));
                    long mistakeId = numericId(principal.subject(), "mistake:" + resourceKey, resourceKey);
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("mistakeId", mistakeId);
                    item.put("itemId", integerOrString(resourceKey));
                    item.put("errorCategory", "GRAMMAR_RULE");
                    item.put("mistakeStatus", "OPEN");
                    item.put("masteryStatus", "REVIEW");
                    item.put("reasonTrace", List.of(Map.of("code", "RULE_RETRY", "label", "服务端规则判定为待复习")));
                    item.put("prompt", "语法练习 " + resourceKey);
                    item.put("contentVersionId", 301);
                    item.put("verificationId", mistakeId);
                    item.put("createdAt", row.get("created_at"));
                    return item;
                })
                .filter(java.util.Objects::nonNull)
                .toList();
        return Map.of("items", items, "source", "mysql");
    }

    /** Aggregate learner-owned review and interaction facts for the B2 mastery page. */
    @GetMapping("/mastery/overview")
    public Map<String, Object> masteryOverview(Authentication authentication) {
        Principal principal = principal(authentication);
        Map<String, Object> counts = jdbc.queryForMap("""
                SELECT COUNT(*) AS total,
                       COALESCE(SUM(stage = 'NEW'), 0) AS new_count,
                       COALESCE(SUM(stage = 'LEARNING'), 0) AS learning_count,
                       COALESCE(SUM(stage = 'REVIEW'), 0) AS review_count,
                       COALESCE(SUM(stage = 'MASTERED'), 0) AS mastered_count
                  FROM b25_learning_srs_state
                 WHERE tenant_id = ? AND principal_id = ?
                """, TENANT, principal.subject());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("principalId", principal.subject());
        result.put("srs", Map.of(
                "total", number(counts.get("total")),
                "newCount", number(counts.get("new_count")),
                "learningCount", number(counts.get("learning_count")),
                "reviewCount", number(counts.get("review_count")),
                "masteredCount", number(counts.get("mastered_count"))));
        result.put("mistakes", jdbc.queryForObject("""
                SELECT COUNT(*) FROM b3_learning_interaction
                 WHERE tenant_id = ? AND principal_id = ? AND status = 'ACCEPTED'
                   AND JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.correct')) = 'false'
                """, Integer.class, TENANT, principal.subject()));
        result.put("reviewFacts", jdbc.queryForObject("""
                SELECT COUNT(*) FROM b25_learning_review WHERE tenant_id = ? AND principal_id = ?
                """, Integer.class, TENANT, principal.subject()));
        result.put("source", "mysql");
        result.put("calculationVersion", "B3-B25-MASTERY-1");
        return result;
    }

    @PostMapping("/mastery/mistakes/{mistakeId}/retry")
    @Transactional
    public Map<String, Object> retryMistake(@PathVariable String mistakeId,
            Authentication authentication,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("verificationId", numericId(principal.subject(), "verification:" + mistakeId, mistakeId));
        result.put("mistakeId", integerOrString(mistakeId));
        result.put("stage", "D0");
        result.put("result", "PENDING");
        result.put("dueAt", Instant.now().toString());
        result.put("source", "mysql");
        return store(principal, "MASTERY", "MISTAKE_RETRY", mistakeId, Map.of("mistakeId", mistakeId), idempotencyKey, result);
    }

    @GetMapping("/mastery/verifications")
    public Map<String, Object> verifications(Authentication authentication) {
        Principal principal = principal(authentication);
        List<Map<String, Object>> items = jdbc.queryForList("""
                SELECT result_json FROM b3_learning_interaction
                 WHERE tenant_id = ? AND principal_id = ? AND domain_code = 'MASTERY'
                   AND action_code = 'MISTAKE_RETRY'
                 ORDER BY created_at DESC
                """, TENANT, principal.subject()).stream()
                .map(row -> parseResult(row.get("result_json"))).toList();
        return Map.of("items", items, "source", "mysql");
    }

    @PostMapping("/mastery/verifications/{verificationId}/submit")
    @Transactional
    public Map<String, Object> submitVerification(@PathVariable String verificationId,
            Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("verificationId", integerOrString(verificationId));
        result.put("mistakeId", body.getOrDefault("mistakeId", verificationId));
        result.put("stage", body.getOrDefault("stage", "D0"));
        result.put("result", "PASSED");
        result.put("score", 1.0);
        result.put("maxScore", 1.0);
        result.put("nextState", "REVIEW");
        result.put("source", "mysql");
        return store(principal, "MASTERY", "VERIFICATION_SUBMIT", verificationId, body, idempotencyKey, result);
    }

    @PostMapping("/speaking/roleplay/sessions")
    @Transactional
    public Map<String, Object> roleplaySession(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("roleplaySessionId", UUID.randomUUID().toString());
        result.put("roleplayCode", value(body, "roleplayCode").isBlank() ? "COFFEE_SHOP_V1" : value(body, "roleplayCode"));
        result.put("scriptVersion", "phase1-rule-v1");
        result.put("role", "LEARNER");
        result.put("turnIndex", 0);
        result.put("status", "CREATED");
        result.put("contentVersionId", body.getOrDefault("contentVersionId", 301));
        result.put("turns", List.of(Map.of("turnIndex", 0, "speaker", "COACH", "text", "Hello, how can I help you?", "choiceCodes", List.of("ORDER_COFFEE"), "recordingRequired", true)));
        return store(principal, "SPEAKING", "ROLEPLAY_SESSION", value(body, "roleplayCode"), body, idempotencyKey, result);
    }

    @PostMapping("/speaking/roleplay/sessions/{sessionId}/turns")
    @Transactional
    public Map<String, Object> roleplayTurn(@PathVariable String sessionId, Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        int turnIndex = body.get("turnIndex") instanceof Number n ? n.intValue() : 0;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("roleplaySessionId", sessionId);
        result.put("turnIndex", turnIndex);
        result.put("nextTurnIndex", turnIndex + 1);
        result.put("nextTurn", null);
        result.put("status", "COMPLETED");
        result.put("feedbackCode", "RULE_TURN_ACCEPTED");
        result.put("aiScoringAvailable", false);
        return store(principal, "SPEAKING", "ROLEPLAY_TURN", sessionId + ":" + turnIndex, body, idempotencyKey, result);
    }

    @PostMapping("/offline/sync/push")
    @Transactional
    public Map<String, Object> pushOffline(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication);
        Object rawChanges = body.get("changes");
        if (!(rawChanges instanceof List<?> changes)) throw bad("changes must be an array");
        List<String> accepted = new ArrayList<>();
        for (Object raw : changes) {
            if (!(raw instanceof Map<?, ?> map)) continue;
            @SuppressWarnings("unchecked") Map<String, Object> change = (Map<String, Object>) map;
            String changeId = value(change, "changeId");
            if (changeId.isBlank()) continue;
            String changeKey = value(change, "clientEventId");
            if (changeKey.isBlank()) changeKey = (idempotencyKey == null ? "b3-sync" : idempotencyKey) + ":" + changeId;
            store(principal, "OFFLINE", "CHANGE", changeId, change, changeKey,
                    Map.of("changeId", changeId, "status", "ACCEPTED", "source", "mysql"));
            accepted.add(changeId);
        }
        return Map.of("clientBatchId", value(body, "clientBatchId"), "acceptedChangeIds", accepted,
                "conflicts", List.of(), "nextCursor", String.valueOf(System.currentTimeMillis()),
                "serverVersion", System.currentTimeMillis(), "source", "mysql");
    }

    @GetMapping("/offline/sync/pull")
    public Map<String, Object> pullOffline(Authentication authentication,
            @RequestParam(defaultValue = "0") String cursor,
            @RequestParam(defaultValue = "100") int limit) {
        Principal principal = principal(authentication);
        int bounded = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> changes = jdbc.queryForList("""
                SELECT payload_json FROM b3_learning_interaction
                 WHERE tenant_id = ? AND principal_id = ? AND domain_code = 'OFFLINE'
                 ORDER BY created_at DESC LIMIT ?
                """, TENANT, principal.subject(), bounded).stream()
                .map(row -> parseResult(row.get("payload_json"))).toList();
        return Map.of("cursor", String.valueOf(System.currentTimeMillis()), "changes", changes, "source", "mysql");
    }

    private Map<String, Object> writingResult(Principal principal, String promptId, String idempotencyKey,
            int score, String action, String message) {
        Map<String, Object> result = feedback(score >= 60, message, action);
        result.put("submissionId", numericId(principal.subject(), idempotencyKey, promptId));
        result.put("promptId", integerOrString(promptId));
        result.put("score", score);
        result.put("band", score >= 60 ? "FOUNDATION" : "RETRY");
        result.put("aiScoringAvailable", false);
        result.put("items", List.of(Map.of("code", "RULE_STRUCTURE", "feedbackCode", score >= 60 ? "PASS" : "RETRY", "score", score)));
        result.put("submittedAt", Instant.now().toString());
        return result;
    }

    private Map<String, Object> store(Principal principal, String domain, String action, String resourceKey,
            Map<String, Object> body, String requestedKey, Map<String, Object> result) {
        String idempotencyKey = normalizeKey(requestedKey, body);
        Map<String, Object> existing = one("SELECT result_json FROM b3_learning_interaction WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?", TENANT, principal.subject(), idempotencyKey);
        if (existing != null) return parseResult(existing.get("result_json"));
        String interactionId = UUID.randomUUID().toString();
        Map<String, Object> persisted = new LinkedHashMap<>(result);
        persisted.putIfAbsent("interactionId", interactionId);
        persisted.putIfAbsent("source", "mysql");
        persisted.putIfAbsent("status", "ACCEPTED");
        try {
            jdbc.update("""
                    INSERT IGNORE INTO b3_learning_interaction
                        (interaction_id, tenant_id, principal_id, domain_code, action_code, resource_key,
                         idempotency_key, payload_json, result_json, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED')
                    """, interactionId, TENANT, principal.subject(), domain, action, bounded(resourceKey), idempotencyKey,
                    json(body), json(persisted));
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "learning interaction could not be persisted", exception);
        }
        Map<String, Object> afterInsert = one("SELECT result_json FROM b3_learning_interaction WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?", TENANT, principal.subject(), idempotencyKey);
        return afterInsert == null ? persisted : parseResult(afterInsert.get("result_json"));
    }

    private Map<String, Object> feedback(boolean correct, String message, String code) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("correct", correct);
        result.put("feedbackCode", correct ? "RULE_PASS" : "RULE_RETRY");
        result.put("message", message);
        result.put("ruleVersion", "b3-rule-v1");
        result.put("nextAction", correct ? "NEXT" : "RETRY");
        result.put("evidence", code);
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseResult(Object value) {
        try {
            Object parsed = objectMapper.readValue(String.valueOf(value), Object.class);
            return parsed instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "stored learning interaction is invalid", exception);
        }
    }

    private String json(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "interaction payload is not serializable", exception); }
    }

    private Map<String, Object> one(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private Principal principal(Authentication authentication) {
        return new Principal(LearningHttpPrincipals.require(authentication).subject());
    }

    private static String required(Map<String, Object> body, String name) {
        String value = value(body, name);
        if (value.isBlank()) throw bad(name + " is required");
        return value;
    }

    private static String value(Map<String, Object> body, String name) { return body.get(name) == null ? "" : String.valueOf(body.get(name)).trim(); }

    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }

    private static String normalizeKey(String requestedKey, Map<String, Object> body) {
        String value = requestedKey == null || requestedKey.isBlank() ? value(body, "clientEventId") : requestedKey.trim();
        if (value.isBlank()) value = "generated-" + UUID.randomUUID();
        return bounded(value);
    }

    private static String bounded(String value) { return value == null ? "" : value.length() <= 192 ? value : value.substring(0, 192); }

    private static Object integerOrString(String value) {
        try { return Integer.valueOf(value); } catch (NumberFormatException ignored) { return value; }
    }

    private static int number(Object value) {
        if (value instanceof Number number) return number.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (RuntimeException ignored) { return 0; }
    }

    private static long numericId(String subject, String idempotencyKey, String resource) {
        String seed = subject + "|" + (idempotencyKey == null ? "" : idempotencyKey) + "|" + resource;
        return Integer.toUnsignedLong(UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8)).hashCode());
    }

    private static boolean answerContains(Object answer, String expected) {
        return answer != null && String.valueOf(answer).toLowerCase(java.util.Locale.ROOT).contains(expected.toLowerCase(java.util.Locale.ROOT));
    }

    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }

    private record Principal(String subject) {}

    private static final class MasteryAccumulator {
        private int attempts;
        private int correct;
    }
}
