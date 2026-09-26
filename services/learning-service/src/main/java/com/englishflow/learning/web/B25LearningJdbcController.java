package com.englishflow.learning.web;

import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** B25 compatibility reads. Legacy review writes are closed until trusted outcome evidence exists. */
@RestController
@RequestMapping("/internal/v1/learning")
@ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "jdbc")
public class B25LearningJdbcController {
    private static final String TENANT = "platform";
    private final JdbcTemplate jdbc;

    public B25LearningJdbcController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/plan/current")
    public Map<String, Object> currentPlan(Authentication authentication) {
        Principal principal = principal(authentication, "learning.plan.read");
        Map<String, Object> row = one("SELECT * FROM b25_learning_plan WHERE principal_id = ? AND tenant_id = ?", principal.subject(), TENANT);
        if (row == null) return Map.of("status", "EMPTY", "principalId", principal.subject(), "targetMinutes", 0);
        return Map.of("planId", row.get("plan_id"), "principalId", principal.subject(), "status", row.get("status"),
                "targetMinutes", number(row.get("target_minutes")), "planVersion", number(row.get("plan_version")), "updatedAt", row.get("updated_at"));
    }

    @GetMapping("/stream/today")
    public Map<String, Object> today(Authentication authentication) {
        Principal principal = principal(authentication, "learning.review.read");
        List<Map<String, Object>> due = jdbc.queryForList("""
                SELECT item_id, stage, due_at, interval_days, ease_factor, review_count
                FROM b25_learning_srs_state
                WHERE principal_id = ? AND tenant_id = ? AND due_at <= CURRENT_TIMESTAMP(6)
                ORDER BY due_at, item_id
                """, principal.subject(), TENANT);
        return Map.of("principalId", principal.subject(), "items", due.stream().map(B25LearningJdbcController::srsView).toList(),
                "count", due.size(), "generatedAt", Instant.now().toString());
    }

    @GetMapping("/srs/overview")
    public Map<String, Object> overview(Authentication authentication) {
        Principal principal = principal(authentication, "learning.review.read");
        Map<String, Object> counts = jdbc.queryForMap("""
                SELECT COUNT(*) total, SUM(stage = 'NEW') new_count, SUM(stage = 'LEARNING') learning_count,
                       SUM(stage = 'REVIEW') review_count, SUM(stage = 'MASTERED') mastered_count
                FROM b25_learning_srs_state WHERE principal_id = ? AND tenant_id = ?
                """, principal.subject(), TENANT);
        return Map.of("principalId", principal.subject(), "verificationStatus", "UNVERIFIED_LEGACY_REVIEW",
                "total", number(counts.get("total")),
                "newCount", number(counts.get("new_count")), "learningCount", number(counts.get("learning_count")),
                "reviewCount", number(counts.get("review_count")), "masteredCount", number(counts.get("mastered_count")));
    }

    /** Canonical B2 SRS state page backed by the learner-owned MySQL projection. */
    @GetMapping("/srs/states")
    public Map<String, Object> states(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String itemType,
            @RequestParam(required = false) String masteryStatus,
            @RequestParam(required = false) String dueRange) {
        Principal principal = principal(authentication, "learning.review.read");
        int bounded = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT item_id, stage, due_at, interval_days, ease_factor, review_count
                  FROM b25_learning_srs_state
                 WHERE principal_id = ? AND tenant_id = ?
                 ORDER BY due_at, item_id LIMIT ?
                """, principal.subject(), TENANT, bounded);
        List<Map<String, Object>> items = rows.stream().map(B25LearningJdbcController::srsView)
                .filter(item -> itemType == null || itemType.isBlank() || itemType.equalsIgnoreCase(text(item.get("itemType"))))
                .filter(item -> masteryStatus == null || masteryStatus.isBlank() || masteryStatus.equalsIgnoreCase(text(item.get("masteryStatus"))))
                .filter(item -> dueRange == null || dueRange.isBlank() || dueRangeMatches(item, dueRange))
                .toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("source", "mysql");
        data.put("verificationStatus", "UNVERIFIED_LEGACY_REVIEW");
        return pageEnvelope(data);
    }

    @GetMapping("/srs/batches")
    public Map<String, Object> batch(Authentication authentication) { return batchFor(authentication); }

    @GetMapping("/srs/batches/{snapshotId}")
    public Map<String, Object> batch(Authentication authentication, @PathVariable long snapshotId) {
        LearningHttpPrincipals.require(authentication, "learning.review.read");
        if (snapshotId < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "snapshotId must be positive");
        // Phase 1 uses one published local content snapshot.  The snapshot is
        // still checked at the owner boundary so a client cannot turn an
        // arbitrary number into a different batch projection.
        if (snapshotId != B25_SRS_SNAPSHOT_ID) {
            throw new ResponseStatusException(HttpStatus.GONE, "srs snapshot has expired");
        }
        return batchFor(authentication);
    }

    @PostMapping("/srs/batches")
    public Map<String, Object> createBatch(Authentication authentication) {
        LearningHttpPrincipals.require(authentication, "learning.review.write");
        return batchFor(authentication);
    }

    /** B2 mined-expression list is scoped to the verified learner principal. */
    @GetMapping("/vocab/expressions")
    public Map<String, Object> expressions(
            Authentication authentication,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) Boolean wantToSay,
            @RequestParam(defaultValue = "20") int limit) {
        Principal principal = principal(authentication, "learning.review.read");
        int boundedLimit = Math.max(1, Math.min(limit, 100));
        String normalizedSource = sourceType == null ? "" : sourceType.trim().toUpperCase(java.util.Locale.ROOT);
        if (!normalizedSource.isBlank() && !expressionSource(normalizedSource)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceType is not supported");
        }
        StringBuilder sql = new StringBuilder("""
                SELECT expression_id, source_type, source_ref, source_content_version,
                       sentence_text, translation_cn, selected_text, want_to_say, status,
                       private_note, created_at, updated_at
                  FROM b2_learner_expression
                 WHERE tenant_id = ? AND principal_id = ? AND status = 'ACTIVE'
                """);
        List<Object> args = new java.util.ArrayList<>(List.of(TENANT, principal.subject()));
        if (!normalizedSource.isBlank()) {
            sql.append(" AND source_type = ?");
            args.add(normalizedSource);
        }
        if (wantToSay != null) {
            sql.append(" AND want_to_say = ?");
            args.add(wantToSay);
        }
        sql.append(" ORDER BY expression_id DESC LIMIT ?");
        args.add(boundedLimit);
        List<Map<String, Object>> items = jdbc.queryForList(sql.toString(), args.toArray())
                .stream().map(B25LearningJdbcController::expressionView).toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("nextCursor", null);
        data.put("source", "mysql");
        return pageEnvelope(data);
    }

    /** Learner-owned vocabulary library; vocabulary bodies are resolved by content-service. */
    @GetMapping("/vocab/library")
    public Map<String, Object> library(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String itemType,
            @RequestParam(required = false) String collectionStatus,
            @RequestParam(required = false) String sourceType) {
        Principal principal = principal(authentication, "learning.review.read");
        int bounded = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT entry_id, item_type, item_id, source_type, collection_status, created_at, updated_at
                  FROM b25_learning_library_entry
                 WHERE tenant_id = ? AND principal_id = ? AND collection_status <> 'REMOVED'
                 ORDER BY entry_id DESC LIMIT ?
                """, TENANT, principal.subject(), bounded);
        List<Map<String, Object>> items = rows.stream()
                .filter(row -> itemType == null || itemType.isBlank() || itemType.equalsIgnoreCase(text(row.get("item_type"))))
                .filter(row -> collectionStatus == null || collectionStatus.isBlank() || collectionStatus.equalsIgnoreCase(text(row.get("collection_status"))))
                .filter(row -> sourceType == null || sourceType.isBlank() || sourceType.equalsIgnoreCase(text(row.get("source_type"))))
                .map(B25LearningJdbcController::libraryView).toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("source", "mysql");
        return pageEnvelope(data);
    }

    @PostMapping("/vocab/library/entries")
    @Transactional
    public Map<String, Object> addLibraryEntry(Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication, "learning.review.write");
        String key = requiredHeader(idempotencyKey, "Idempotency-Key");
        String type = text(body.get("itemType")).toUpperCase(java.util.Locale.ROOT);
        if (!List.of("VOCAB", "CHUNK", "EXPRESSION").contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "itemType is not supported");
        }
        String itemId = itemId(body);
        if (itemId.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "an item id is required");
        String source = text(body.get("sourceType"));
        if (source.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceType is required");
        String status = text(body.get("collectionStatus"));
        if (status.isBlank()) status = "SAVED";
        if (!List.of("NEW_WORD", "SAVED", "MASTERED").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "collectionStatus is not supported");
        }
        jdbc.update("""
                INSERT INTO b25_learning_library_entry
                    (principal_id, tenant_id, item_type, item_id, source_type, collection_status, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE source_type = VALUES(source_type),
                    collection_status = VALUES(collection_status), idempotency_key = VALUES(idempotency_key),
                    updated_at = CURRENT_TIMESTAMP(6)
                """, principal.subject(), TENANT, type, itemId, source, status, key);
        Map<String, Object> row = one("""
                SELECT entry_id, item_type, item_id, source_type, collection_status, created_at, updated_at
                  FROM b25_learning_library_entry
                 WHERE tenant_id = ? AND principal_id = ? AND item_type = ? AND item_id = ?
                """, TENANT, principal.subject(), type, itemId);
        return Map.of("source", "mysql", "data", libraryView(row));
    }

    @DeleteMapping("/vocab/library/entries/{entryId}")
    @Transactional
    public Map<String, Object> removeLibraryEntry(Authentication authentication,
            @PathVariable long entryId,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication, "learning.review.write");
        requiredHeader(idempotencyKey, "Idempotency-Key");
        jdbc.update("""
                UPDATE b25_learning_library_entry SET collection_status = 'REMOVED', updated_at = CURRENT_TIMESTAMP(6)
                 WHERE entry_id = ? AND tenant_id = ? AND principal_id = ?
                """, entryId, TENANT, principal.subject());
        return Map.of("source", "mysql", "data", Map.of("entryId", entryId, "status", "REMOVED"));
    }

    /** B2 expression detail is also the reveal projection used by the learner Web card. */
    @GetMapping("/vocab/expressions/{expressionId}")
    public Map<String, Object> expression(Authentication authentication, @PathVariable long expressionId) {
        Principal principal = principal(authentication, "learning.review.read");
        return expressionResponse(expressionRow(principal.subject(), expressionId));
    }

    @PostMapping("/vocab/expressions")
    @Transactional
    public Map<String, Object> createExpression(
            Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication, "learning.review.write");
        String key = requiredHeader(idempotencyKey, "Idempotency-Key");
        String sourceType = required(body, "sourceType", 32).toUpperCase(java.util.Locale.ROOT);
        if (!expressionSource(sourceType)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "sourceType is not supported");
        }
        String sentence = required(body, "sentenceText", 5000);
        int rangeStart = optionalBoundedInteger(body.get("rangeStart"), 0, Integer.MAX_VALUE, "rangeStart");
        int rangeEnd = optionalBoundedInteger(body.get("rangeEnd"), 1, Integer.MAX_VALUE, "rangeEnd");
        if (rangeStart >= 0 && rangeEnd >= 0 && rangeEnd < rangeStart) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "rangeEnd must be >= rangeStart");
        }
        Map<String, Object> replay = expressionRowByKey(principal.subject(), key);
        if (replay != null) return expressionResponse(replay, true);
        int inserted = jdbc.update("""
                INSERT IGNORE INTO b2_learner_expression
                    (tenant_id, principal_id, source_type, source_ref, source_content_version,
                     sentence_text, translation_cn, selected_text, range_start, range_end,
                     want_to_say, private_note, tag_ids_json, status, create_idempotency_key,
                     last_idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, JSON_ARRAY(), 'ACTIVE', ?, ?)
                """, TENANT, principal.subject(), sourceType,
                nullableText(body.get("sourceRef"), 192), nullableText(body.get("sourceContentVersion"), 64),
                sentence, nullableText(body.get("translationCn"), 2048), nullableText(body.get("selectedText"), 2048),
                rangeStart < 0 ? null : rangeStart, rangeEnd < 0 ? null : rangeEnd,
                Boolean.TRUE.equals(body.get("wantToSay")), nullableText(body.get("privateNote"), 2048), key, key);
        Map<String, Object> row = expressionRowByKey(principal.subject(), key);
        if (row == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "expression was not persisted");
        }
        return expressionResponse(row, inserted == 0);
    }

    @PatchMapping("/vocab/expressions/{expressionId}")
    @Transactional
    public Map<String, Object> updateExpression(
            Authentication authentication,
            @PathVariable long expressionId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication, "learning.review.write");
        String key = requiredHeader(idempotencyKey, "Idempotency-Key");
        Map<String, Object> current = expressionRow(principal.subject(), expressionId);
        boolean wantToSay = body.containsKey("wantToSay")
                ? Boolean.TRUE.equals(body.get("wantToSay"))
                : Boolean.TRUE.equals(current.get("want_to_say"));
        String privateNote = body.containsKey("privateNote")
                ? nullableText(body.get("privateNote"), 2048)
                : nullableText(current.get("private_note"), 2048);
        jdbc.update("""
                UPDATE b2_learner_expression
                   SET want_to_say = ?, private_note = ?, last_idempotency_key = ?
                 WHERE expression_id = ? AND tenant_id = ? AND principal_id = ? AND status <> 'DELETED'
                """, wantToSay, privateNote, key, expressionId, TENANT, principal.subject());
        return expressionResponse(expressionRow(principal.subject(), expressionId));
    }

    @DeleteMapping("/vocab/expressions/{expressionId}")
    @Transactional
    public Map<String, Object> deleteExpression(
            Authentication authentication,
            @PathVariable long expressionId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Principal principal = principal(authentication, "learning.review.write");
        String key = requiredHeader(idempotencyKey, "Idempotency-Key");
        int updated = jdbc.update("""
                UPDATE b2_learner_expression
                   SET status = 'DELETED', last_idempotency_key = ?
                 WHERE expression_id = ? AND tenant_id = ? AND principal_id = ? AND status <> 'DELETED'
                """, key, expressionId, TENANT, principal.subject());
        if (updated == 0 && expressionRow(principal.subject(), expressionId) == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "expression is not owned by the verified principal");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("expressionId", expressionId);
        data.put("deleted", true);
        data.put("replayed", updated == 0);
        data.put("source", "mysql");
        return Map.of("source", "mysql", "data", data);
    }

    @PostMapping("/srs/reviews")
    public Map<String, Object> review(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        return rejectUntrustedReview(authentication);
    }

    @PostMapping("/srs/reviews:sync")
    public Map<String, Object> sync(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        return rejectUntrustedReview(authentication);
    }

    @GetMapping("/stats/daily-summary")
    public Map<String, Object> dailySummary(Authentication authentication) {
        Principal principal = principal(authentication, "learning.progress.read");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("principalId", principal.subject());
        result.put("reviewCount", null);
        result.put("qualityTotal", null);
        result.put("verificationStatus", "UNVERIFIED_LEGACY_REVIEW");
        result.put("source", "learning-service");
        return result;
    }

    /** Compatibility report shape. Legacy client-rated rows are not verified learning facts. */
    @GetMapping("/stats/daily-report")
    public Map<String, Object> dailyReport(Authentication authentication,
            @RequestParam(required = false) String date) {
        Principal principal = principal(authentication, "learning.progress.read");
        LocalDate day = parseDate(date, LocalDate.now(ZoneOffset.UTC));
        return report(principal.subject(), day, day.plusDays(1), "DAILY");
    }

    @GetMapping("/stats/weekly-report")
    public Map<String, Object> weeklyReport(Authentication authentication,
            @RequestParam(required = false) String weekStart) {
        Principal principal = principal(authentication, "learning.progress.read");
        LocalDate requested = parseDate(weekStart, LocalDate.now(ZoneOffset.UTC));
        LocalDate start = requested.with(DayOfWeek.MONDAY);
        return report(principal.subject(), start, start.plusDays(7), "WEEKLY");
    }

    /** B18 uses the learning owner for the same durable SRS queue. */
    @GetMapping("/review-queue")
    public Map<String, Object> reviewQueue(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        Principal principal = principal(authentication, "learning.review.read");
        int boundedLimit = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT item_id, stage, due_at, review_count
                FROM b25_learning_srs_state
                WHERE principal_id = ? AND tenant_id = ? AND due_at <= CURRENT_TIMESTAMP(6)
                ORDER BY due_at, item_id LIMIT ?
                """, principal.subject(), TENANT, boundedLimit);
        List<Map<String, Object>> items = new java.util.ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            Map<String, Object> row = rows.get(index);
            Map<String, Object> item = new LinkedHashMap<>();
            String itemId = text(row.get("item_id"));
            String stage = text(row.get("stage"));
            item.put("queueItemId", itemId);
            item.put("itemId", itemId);
            item.put("source", "NEW".equals(stage) ? "NEW" : "REVIEW");
            item.put("state", stage);
            item.put("dueAt", row.get("due_at"));
            item.put("priority", Math.max(1, 100 - index));
            item.put("stateVersion", number(row.get("review_count")));
            item.put("completable", false);
            item.put("unavailableReason", "UNTRUSTED_REVIEW_EVIDENCE");
            items.add(item);
        }
        return Map.of("principalId", principal.subject(), "items", items, "source", "mysql");
    }

    @PostMapping("/review-queue/{queueItemId}/complete")
    public Map<String, Object> completeReviewQueue(Authentication authentication,
            @PathVariable String queueItemId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return rejectUntrustedReview(authentication);
    }

    @GetMapping("/mistakes/queue")
    public Map<String, Object> mistakes(Authentication authentication,
            @RequestParam(required = false) String status) {
        Principal principal = principal(authentication, "learning.mastery.read");
        String requestedStatus = status == null ? "" : status.trim().toUpperCase(java.util.Locale.ROOT);
        if (requestedStatus.length() > 32) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status is too long");
        }
        List<Map<String, Object>> items = jdbc.queryForList("""
                SELECT interaction_id, resource_key, domain_code, action_code,
                       JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.correct')) AS correct_value,
                       JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.feedbackCode')) AS feedback_code,
                       JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.message')) AS message,
                       JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.errorCategory')) AS error_category,
                       JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.mistakeStatus')) AS mistake_status,
                       created_at
                  FROM b3_learning_interaction
                 WHERE tenant_id = ? AND principal_id = ? AND status = 'ACCEPTED'
                 ORDER BY created_at DESC, interaction_id DESC
                """, TENANT, principal.subject()).stream()
                .filter(row -> !"true".equalsIgnoreCase(text(row.get("correct_value"))))
                .map(row -> {
                    String mistakeStatus = text(row.get("mistake_status"));
                    if (mistakeStatus.isBlank()) mistakeStatus = "OPEN";
                    if (!requestedStatus.isBlank() && !requestedStatus.equals(mistakeStatus)) return null;
                    String interactionId = text(row.get("interaction_id"));
                    String resourceKey = text(row.get("resource_key"));
                    String mistakeId = UUID.nameUUIDFromBytes((principal.subject() + "|" + interactionId)
                            .getBytes(StandardCharsets.UTF_8)).toString();
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("mistakeId", mistakeId);
                    item.put("itemId", resourceKey);
                    item.put("itemType", text(row.get("domain_code")));
                    item.put("status", mistakeStatus);
                    item.put("mistakeStatus", mistakeStatus);
                    item.put("errorCategory", text(row.get("error_category")).isBlank()
                            ? "RULE_RETRY" : text(row.get("error_category")));
                    item.put("reasonTrace", List.of(Map.of(
                            "code", text(row.get("feedback_code")).isBlank()
                                    ? "RULE_RETRY" : text(row.get("feedback_code")),
                            "label", text(row.get("message")).isBlank()
                                    ? "服务端规则判定为待复习" : text(row.get("message")))));
                    item.put("resourceKey", resourceKey);
                    item.put("action", text(row.get("action_code")));
                    item.put("contentVersionId", B25_CONTENT_VERSION_ID);
                    item.put("createdAt", row.get("created_at"));
                    item.put("source", "mysql");
                    return item;
                })
                .filter(java.util.Objects::nonNull)
                .toList();
        return Map.of("principalId", principal.subject(), "items", items, "source", "mysql");
    }

    @GetMapping("/continue-context")
    public Map<String, Object> continueContext(Authentication authentication) {
        Principal principal = principal(authentication, "learning.progress.read");
        Map<String, Object> row = one("SELECT * FROM b25_learning_continue_context WHERE principal_id = ? AND tenant_id = ?",
                principal.subject(), TENANT);
        if (row == null) return Map.of("hasContext", false, "empty", true, "source", "mysql");
        return continueView(row);
    }

    @PutMapping("/continue-context")
    @Transactional
    public Map<String, Object> saveContinueContext(Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication, "learning.progress.write");
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? text(body.get("clientEventId")) : idempotencyKey.trim();
        if (key.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key is required");
        Map<String, Object> current = one("SELECT * FROM b25_learning_continue_context WHERE principal_id = ? AND tenant_id = ?",
                principal.subject(), TENANT);
        if (current != null && key.equals(text(current.get("last_idempotency_key")))) return continueView(current);

        String moduleId = required(body, "moduleId", 128);
        String moduleLabel = required(body, "moduleLabel", 255);
        String lessonId = required(body, "lessonId", 128);
        String lessonTitle = required(body, "lessonTitle", 255);
        int totalSteps = boundedInteger(body.get("totalSteps"), 1, 100000, "totalSteps");
        int stepIndex = boundedInteger(body.get("stepIndex"), 1, totalSteps, "stepIndex");
        long elapsedTimeMs = boundedLong(body.get("elapsedTimeMs"), 0L, 86_400_000L, "elapsedTimeMs");
        String status = text(body.get("status")).toUpperCase(java.util.Locale.ROOT);
        if (!"ACTIVE".equals(status) && !"EXPIRED".equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status must be ACTIVE or EXPIRED");
        }
        jdbc.update("""
                INSERT INTO b25_learning_continue_context
                    (tenant_id, principal_id, module_id, module_label, lesson_id, lesson_title,
                     step_index, total_steps, elapsed_time_ms, status, last_idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    module_id = VALUES(module_id), module_label = VALUES(module_label),
                    lesson_id = VALUES(lesson_id), lesson_title = VALUES(lesson_title),
                    step_index = VALUES(step_index), total_steps = VALUES(total_steps),
                    elapsed_time_ms = VALUES(elapsed_time_ms), status = VALUES(status),
                    last_idempotency_key = VALUES(last_idempotency_key)
                """,
                TENANT, principal.subject(), moduleId, moduleLabel, lessonId, lessonTitle,
                stepIndex, totalSteps, elapsedTimeMs, status, key);
        return continueContext(authentication);
    }

    private Map<String, Object> batchFor(Authentication authentication) {
        Principal principal = principal(authentication, "learning.review.read");
        // b25 rows have neither a published content pin nor a trusted assessment
        // outcome. Do not present fixture/legacy rows as a completable batch.
        return Map.of("snapshotId", B25_SRS_SNAPSHOT_ID, "principalId", principal.subject(),
                 "localDate", LocalDate.now(ZoneOffset.UTC).toString(), "contentEpoch", 1,
                 "cards", List.of(), "items", List.of(), "status", "RECOVERY_REQUIRED",
                 "reasonCode", "UNTRUSTED_REVIEW_EVIDENCE", "source", "learning-service");
    }

    private Map<String, Object> report(String subject, LocalDate start, LocalDate end, String reportType) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("reportId", UUID.nameUUIDFromBytes((subject + "|" + reportType + "|" + start)
                .getBytes(StandardCharsets.UTF_8)).toString());
        result.put("reportType", reportType);
        result.put("status", "PARTIAL");
        result.put("generatedAt", Instant.now().toString());
        result.put("calculationVersion", "B25-LEGACY-UNVERIFIED-1");
        // Historical b25 rows were accepted from client quality/PASS. Preserve
        // them in storage, but never recast them as verified learning outcomes.
        result.put("studyMinutes", null);
        result.put("newItems", null);
        result.put("reviewItems", null);
        result.put("accuracy", null);
        result.put("masteredIncrement", null);
        result.put("forgettingRate", null);
        result.put("d1Pending", null);
        result.put("d7Pending", null);
        result.put("weakness", List.of());
        result.put("verificationStatus", "UNVERIFIED_LEGACY_REVIEW");
        result.put("reasonCode", "TRUSTED_REVIEW_FACTS_UNAVAILABLE");
        result.put("source", "learning-service");
        result.put("periodStart", start.toString());
        result.put("periodEndExclusive", end.toString());
        return result;
    }

    private static LocalDate parseDate(String value, LocalDate fallback) {
        if (value == null || value.isBlank()) return fallback;
        try { return LocalDate.parse(value); }
        catch (java.time.format.DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date must use yyyy-MM-dd");
        }
    }

    private static Map<String, Object> rejectUntrustedReview(Authentication authentication) {
        LearningHttpPrincipals.require(authentication, "learning.review.write");
        throw new ResponseStatusException(HttpStatus.CONFLICT, "UNTRUSTED_REVIEW_EVIDENCE");
    }

    private static Map<String, Object> srsView(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        String itemId = text(row.get("item_id"));
        result.put("itemId", itemId); result.put("item", Map.of("itemType", "VOCAB", "itemId", itemId, "vocabularyId", itemId));
        result.put("itemType", "VOCAB"); result.put("snapshotId", B25_SRS_SNAPSHOT_ID);
        result.put("snapshotItemId", B25_SRS_SNAPSHOT_ITEM_ID); result.put("contentVersionId", B25_CONTENT_VERSION_ID);
        result.put("stage", row.get("stage")); result.put("masteryStatus", row.get("stage"));
        result.put("dueAt", row.get("due_at")); result.put("intervalDays", number(row.get("interval_days")));
        result.put("easeFactor", row.get("ease_factor")); result.put("reviewCount", number(row.get("review_count")));
        result.put("stateVersion", number(row.get("review_count")));
        result.put("dueLocalDate", row.get("due_at"));
        result.put("delayedVerifyStage", "NONE");
        result.put("riskBand", "NEW".equals(row.get("stage")) ? "MEDIUM" : "LOW");
        result.put("verificationStatus", "UNVERIFIED_LEGACY_REVIEW");
        return result;
    }

    private static Map<String, Object> libraryView(Map<String, Object> row) {
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "library entry not found");
        String type = text(row.get("item_type"));
        String itemId = text(row.get("item_id"));
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("itemType", type);
        if ("VOCAB".equals(type)) item.put("vocabId", itemId);
        if ("CHUNK".equals(type)) item.put("chunkId", itemId);
        if ("EXPRESSION".equals(type)) item.put("expressionId", itemId);
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("entryId", row.get("entry_id"));
        view.put("item", item);
        view.put("collectionStatus", row.get("collection_status"));
        view.put("sourceType", row.get("source_type"));
        view.put("createdAt", row.get("created_at"));
        view.put("updatedAt", row.get("updated_at"));
        return view;
    }

    private static boolean dueRangeMatches(Map<String, Object> item, String raw) {
        String range = raw.toUpperCase(java.util.Locale.ROOT);
        Object due = item.get("dueAt");
        if (!(due instanceof java.sql.Timestamp timestamp)) return false;
        java.time.Instant instant = timestamp.toInstant();
        java.time.Instant now = java.time.Instant.now();
        return switch (range) {
            case "TODAY" -> instant.isBefore(now.plus(1, ChronoUnit.DAYS));
            case "OVERDUE" -> instant.isBefore(now);
            case "UPCOMING" -> !instant.isBefore(now);
            case "AT_RISK" -> "HIGH".equals(text(item.get("riskBand")));
            default -> false;
        };
    }

    private static String itemId(Map<String, Object> body) {
        Object item = body.get("item");
        if (item instanceof Map<?, ?> values) {
            Object value = values.get("itemId");
            if (value == null) value = values.get("vocabularyId");
            if (value == null) value = values.get("vocabId");
            if (value == null) value = values.get("chunkId");
            if (value == null) value = values.get("expressionId");
            if (value != null) return text(value);
        }
        for (String key : List.of("vocabId", "chunkId", "expressionId", "itemId")) {
            if (body.get(key) != null) return text(body.get(key));
        }
        return "";
    }

    private Map<String, Object> expressionRow(String subject, long expressionId) {
        if (expressionId < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "expressionId must be positive");
        }
        Map<String, Object> row = one("""
                SELECT expression_id, source_type, source_ref, source_content_version,
                       sentence_text, translation_cn, selected_text, want_to_say, status,
                       private_note, created_at, updated_at
                  FROM b2_learner_expression
                 WHERE expression_id = ? AND tenant_id = ? AND principal_id = ?
                """, expressionId, TENANT, subject);
        if (row == null || "DELETED".equals(text(row.get("status")))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "expression not found");
        }
        return row;
    }

    private Map<String, Object> expressionRowByKey(String subject, String key) {
        return one("""
                SELECT expression_id, source_type, source_ref, source_content_version,
                       sentence_text, translation_cn, selected_text, want_to_say, status,
                       private_note, created_at, updated_at
                  FROM b2_learner_expression
                 WHERE tenant_id = ? AND principal_id = ? AND create_idempotency_key = ?
                """, TENANT, subject, key);
    }

    private static Map<String, Object> expressionView(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("expressionId", row.get("expression_id"));
        result.put("sourceType", row.get("source_type"));
        result.put("sourceRef", row.get("source_ref"));
        result.put("sourceContentVersion", row.get("source_content_version"));
        result.put("sentenceText", row.get("sentence_text"));
        result.put("translationCn", row.get("translation_cn"));
        result.put("selectedText", row.get("selected_text"));
        result.put("wantToSay", Boolean.TRUE.equals(row.get("want_to_say")) || number(row.get("want_to_say")) == 1);
        result.put("tags", List.of());
        result.put("status", row.get("status"));
        result.put("createdAt", row.get("created_at"));
        result.put("updatedAt", row.get("updated_at"));
        return result;
    }

    private static Map<String, Object> expressionResponse(Map<String, Object> row) {
        return expressionResponse(row, false);
    }

    private static Map<String, Object> expressionResponse(Map<String, Object> row, boolean replayed) {
        Map<String, Object> expression = expressionView(row);
        Map<String, Object> back = new LinkedHashMap<>();
        back.put("meaningCn", row.get("translation_cn"));
        back.put("definitionEn", null);
        back.put("partOfSpeech", null);
        Map<String, Object> example = new LinkedHashMap<>();
        example.put("sentence", row.get("sentence_text"));
        example.put("translation", row.get("translation_cn"));
        back.put("examples", List.of(example));
        back.put("collocations", List.of());
        back.put("answerAvailable", true);
        expression.put("back", back);
        expression.put("source", "mysql");
        Map<String, Object> data = new LinkedHashMap<>();
        data.putAll(expression);
        data.put("replayed", replayed);
        return Map.of("source", "mysql", "data", data);
    }

    private static Map<String, Object> pageEnvelope(Map<String, Object> data) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("hasMore", false);
        meta.put("nextCursor", null);
        return Map.of("source", "mysql", "data", data, "meta", meta);
    }

    private static boolean expressionSource(String value) {
        return switch (value) {
            case "READING", "LISTENING", "SCENARIO", "VOCAB_EXAMPLE" -> true;
            default -> false;
        };
    }

    private static String requiredHeader(String value, String name) {
        if (value == null || value.isBlank() || value.length() > 192) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is required");
        }
        return value.trim();
    }

    private static String nullableText(Object value, int maxLength) {
        if (value == null) return null;
        String result = text(value);
        if (result.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "text field is too long");
        }
        return result.isBlank() ? null : result;
    }

    private static int optionalBoundedInteger(Object value, int minimum, int maximum, String name) {
        if (value == null) return -1;
        return boundedInteger(value, minimum, maximum, name);
    }

    private Map<String, Object> one(String sql, Object... args) { List<Map<String, Object>> rows = jdbc.queryForList(sql, args); return rows.isEmpty() ? null : rows.get(0); }
    private static Map<String, Object> continueView(Map<String, Object> row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("hasContext", true);
        view.put("empty", false);
        view.put("moduleId", row.get("module_id"));
        view.put("moduleLabel", row.get("module_label"));
        view.put("lessonId", row.get("lesson_id"));
        view.put("lessonTitle", row.get("lesson_title"));
        view.put("stepIndex", number(row.get("step_index")));
        view.put("totalSteps", number(row.get("total_steps")));
        view.put("elapsedTimeMs", row.get("elapsed_time_ms"));
        view.put("status", row.get("status"));
        view.put("updatedAt", row.get("updated_at"));
        view.put("source", "mysql");
        return view;
    }
    private Principal principal(Authentication authentication, String permission) {
        return new Principal(LearningHttpPrincipals.require(authentication, permission).subject());
    }
    private static final long B25_SRS_SNAPSHOT_ID = 25001L;
    private static final long B25_SRS_SNAPSHOT_ITEM_ID = 25001L;
    private static final long B25_CONTENT_VERSION_ID = 25001L;

    private static String text(Object value) { return value instanceof String s ? s.trim() : value == null ? "" : String.valueOf(value).trim(); }
    private static int number(Object value) { return value instanceof Number n ? n.intValue() : 0; }
    private static String required(Map<String, Object> body, String name, int maxLength) {
        String value = text(body.get(name));
        if (value.isBlank() || value.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is required");
        }
        return value;
    }
    private static int boundedInteger(Object value, int minimum, int maximum, String name) {
        if (!(value instanceof Number number) || number.intValue() < minimum || number.intValue() > maximum) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is out of range");
        }
        return number.intValue();
    }
    private static long boundedLong(Object value, long minimum, long maximum, String name) {
        if (!(value instanceof Number number) || number.longValue() < minimum || number.longValue() > maximum) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is out of range");
        }
        return number.longValue();
    }
    private record Principal(String subject) {}
}
