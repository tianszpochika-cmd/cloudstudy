package com.englishflow.learner.web;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** B25 local MySQL onboarding seam; Gateway owns the public learner route. */
@RestController
@RequestMapping("/internal/v1/learner")
@ConditionalOnProperty(prefix = "learner.persistence", name = "mode", havingValue = "jdbc")
public class B25LearnerJdbcController {

    private static final String TENANT = "platform";
    private static final List<Integer> DAILY_QUOTA_MINUTES = List.of(5, 15, 30, 45);
    private static final Logger LOGGER = LoggerFactory.getLogger(B25LearnerJdbcController.class);
    private final JdbcTemplate jdbc;

    public B25LearnerJdbcController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/profile")
    public Map<String, Object> profile(Authentication authentication) {
        Principal p = principal(authentication);
        return envelope(profileData(p));
    }

    @PatchMapping("/profile")
    public Map<String, Object> patchProfile(@RequestBody(required = false) Map<String, Object> request,
            Authentication authentication, @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal p = principal(authentication);
        Map<String, Object> current = profileRow(p);
        Map<String, Object> body = request == null ? Map.of() : request;
        jdbc.update("""
                INSERT INTO b25_learner_profile
                    (principal_id, tenant_id, status, nickname, accent_pref, birth_year, age_confirmed,
                     privacy_consent, terms_consent, ui_locale, content_locale, timezone, theme_mode, state_version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE status = VALUES(status), birth_year = VALUES(birth_year),
                    nickname = VALUES(nickname), accent_pref = VALUES(accent_pref),
                    age_confirmed = VALUES(age_confirmed), privacy_consent = VALUES(privacy_consent),
                    terms_consent = VALUES(terms_consent), ui_locale = VALUES(ui_locale),
                    content_locale = VALUES(content_locale), timezone = VALUES(timezone),
                    theme_mode = VALUES(theme_mode), state_version = state_version + 1
                """, p.subject(), TENANT,
                text(body, "status", text(current, "status", "ONBOARDING")),
                boundedText(body, "nickname", text(current, "nickname", "学习者"), 96),
                accent(body, text(current, "accent_pref", "US")),
                integerOrNull(body, "birthYear", current.get("birth_year")),
                bool(body, "ageConfirmed", current, false), bool(body, "privacyConsent", current, false),
                bool(body, "termsConsent", current, false),
                text(body, "uiLocale", text(current, "ui_locale", "zh-CN")),
                text(body, "contentLocale", text(current, "content_locale", "en-US")),
                text(body, "timezone", text(current, "timezone", "Asia/Shanghai")),
                text(body, "themeMode", text(current, "theme_mode", "SYSTEM")));
        return profile(authentication);
    }

    @GetMapping("/targets")
    public Map<String, Object> target(Authentication authentication) {
        Principal p = principal(authentication);
        Map<String, Object> row = one("""
                SELECT principal_id, goal_code, target_level, daily_quota_minutes, status, updated_at
                  FROM b25_learner_goal WHERE principal_id = ? AND tenant_id = ?
                """, p.subject(), TENANT);
        if (row == null) throw notFound("learner goal is not initialized");
        return envelope(row);
    }

    @PutMapping("/targets")
    public Map<String, Object> putTarget(@RequestBody Map<String, Object> request,
            Authentication authentication, @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal p = principal(authentication);
        String goalCode = required(request, "goalCode");
        String targetLevel = required(request, "targetLevel");
        int dailyQuotaMinutes = integer(request, "dailyQuotaMinutes", 15);
        if (!DAILY_QUOTA_MINUTES.contains(dailyQuotaMinutes)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "dailyQuotaMinutes must be one of 5, 15, 30, or 45");
        }
        jdbc.update("""
                INSERT INTO b25_learner_goal
                    (principal_id, tenant_id, goal_code, target_level, daily_quota_minutes, status, idempotency_key)
                VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
                ON DUPLICATE KEY UPDATE goal_code = VALUES(goal_code), target_level = VALUES(target_level),
                    daily_quota_minutes = VALUES(daily_quota_minutes), status = 'ACTIVE',
                    idempotency_key = VALUES(idempotency_key)
                """, p.subject(), TENANT, goalCode, targetLevel,
                dailyQuotaMinutes, idempotencyKey);
        return target(authentication);
    }

    /**
     * Returns the durable Phase 1 onboarding reference data owned by learner-service.
     * The UI can still use its compiled fallback during an outage, but a healthy
     * authenticated session reads the same options from MySQL as the profile facts.
     */
    @GetMapping("/onboarding/options")
    public Map<String, Object> onboardingOptions(Authentication authentication) {
        principal(authentication);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT option_type, option_code, label, description, numeric_value
                  FROM b25_onboarding_option
                 WHERE enabled = TRUE
                 ORDER BY option_type, display_order, option_id
                """);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("languages", optionViews(rows, "LANGUAGE"));
        data.put("goals", optionViews(rows, "GOAL"));
        data.put("examTypes", optionViews(rows, "EXAM"));
        data.put("quotas", rows.stream().filter(row -> "QUOTA".equals(text(row.get("option_type"))))
                .map(row -> integerValue(row.get("numeric_value"), 0)).filter(value -> value > 0).toList());
        data.put("dailyQuotaMinutes", data.get("quotas"));
        data.put("accentPreferences", optionViews(rows, "ACCENT"));
        data.put("maxPreferenceTags", 3);
        data.put("source", "mysql");
        return envelope(data);
    }

    /** Stable B1 read path backed by the learner-owned daily task projection. */
    @GetMapping("/onboarding/daily-tasks/today")
    public Map<String, Object> dailyTasksToday(Authentication authentication) {
        Principal p = principal(authentication);
        Map<String, Object> data = new LinkedHashMap<>(dailyStreamData(p));
        data.put("localDate", java.time.LocalDate.now(java.time.ZoneId.of("Asia/Shanghai")).toString());
        data.put("planVersion", 1L);
        data.put("generatedAt", Instant.now().toString());
        return envelope(data);
    }

    /**
     * Creates the learner-owned daily projection for a published content reference.
     *
     * <p>The content service remains the owner of the content body and publication
     * decision. This command only stores the learner's local task projection; the
     * client must provide a content reference that it has just read from the
     * published catalog.</p>
    */
    @PostMapping("/onboarding/daily-tasks/ensure")
    public Map<String, Object> ensureDailyTask(@RequestBody Map<String, Object> request,
            Authentication authentication, @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal p = principal(authentication);
        String contentCode = boundedRequired(request, "contentCode", 128);
        String title = boundedRequired(request, "title", 255);
        int minutes = integer(request, "minutes", 5);
        if (minutes < 1 || minutes > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "minutes must be between 1 and 60");
        }
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key is required");
        }
        String taskId = UUID.nameUUIDFromBytes((p.subject() + "|" + contentCode).getBytes(StandardCharsets.UTF_8)).toString();
        try {
            jdbc.update("""
                    INSERT INTO b25_learner_daily_task
                        (task_id, principal_id, tenant_id, content_code, title, task_type, minutes,
                         task_status, task_order, idempotency_key)
                    VALUES (?, ?, ?, ?, ?, 'LESSON', ?, 'AVAILABLE', 1, ?)
                    ON DUPLICATE KEY UPDATE
                        content_code = IF(principal_id = VALUES(principal_id) AND content_code = VALUES(content_code),
                            VALUES(content_code), content_code),
                        title = IF(principal_id = VALUES(principal_id) AND content_code = VALUES(content_code),
                            VALUES(title), title),
                        minutes = IF(principal_id = VALUES(principal_id) AND content_code = VALUES(content_code),
                            VALUES(minutes), minutes),
                        task_status = IF(principal_id = VALUES(principal_id) AND content_code = VALUES(content_code),
                            IF(task_status = 'COMPLETED', 'COMPLETED', 'AVAILABLE'), task_status),
                        idempotency_key = IF(principal_id = VALUES(principal_id) AND content_code = VALUES(content_code),
                            VALUES(idempotency_key), idempotency_key)
                    """, taskId, p.subject(), TENANT, contentCode, title, minutes, idempotencyKey);
        } catch (RuntimeException exception) {
            LOGGER.error("B25 daily task owner write failed contentCode={} minutes={} keyLength={}",
                    contentCode, minutes, idempotencyKey.length(), exception);
            throw exception;
        }
        Map<String, Object> row = one("""
                SELECT task_id, content_code, title, task_type, minutes, task_status, task_order, completed_at
                  FROM b25_learner_daily_task
                 WHERE principal_id = ? AND tenant_id = ? AND content_code = ?
                """, p.subject(), TENANT, contentCode);
        if (row == null) {
            Map<String, Object> conflicting = one("""
                    SELECT principal_id, content_code
                      FROM b25_learner_daily_task
                     WHERE tenant_id = ? AND idempotency_key = ?
                    """, TENANT, idempotencyKey);
            if (conflicting != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Idempotency-Key is already used for another learner task");
            }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "daily task projection was not persisted");
        }
        return envelope(row);
    }

    @GetMapping("/preferences")
    public Map<String, Object> preferences(Authentication authentication) {
        Principal p = principal(authentication);
        Map<String, Object> row = preferenceRow(p);
        if (row.isEmpty()) throw notFound("learner preferences are not initialized");
        return envelope(row);
    }

    @PatchMapping("/preferences")
    public Map<String, Object> patchPreferences(@RequestBody Map<String, Object> request,
            Authentication authentication, @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal p = principal(authentication);
        Map<String, Object> current = preferenceRow(p);
        jdbc.update("""
                INSERT INTO b25_learner_preferences
                    (principal_id, tenant_id, ui_locale, content_locale, timezone, theme_mode,
                     high_contrast, motion_mode, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE ui_locale = VALUES(ui_locale), content_locale = VALUES(content_locale),
                    timezone = VALUES(timezone), theme_mode = VALUES(theme_mode),
                    high_contrast = VALUES(high_contrast), motion_mode = VALUES(motion_mode),
                    idempotency_key = VALUES(idempotency_key)
                """, p.subject(), TENANT,
                text(request, "uiLocale", text(current, "ui_locale", "zh-CN")),
                text(request, "contentLocale", text(current, "content_locale", "en-US")),
                text(request, "timezone", text(current, "timezone", "Asia/Shanghai")),
                text(request, "themeMode", text(current, "theme_mode", "SYSTEM")),
                bool(request, "highContrast", current, false),
                text(request, "motionMode", text(current, "motion_mode", "FULL")), idempotencyKey);
        return preferences(authentication);
    }

    /**
     * Creates a self-scoped privacy export job in the learner owner schema.
     * The export worker/audit service can consume this durable fact later; the
     * Web client only receives the queued job identity and never a fake file URL.
     */
    @PostMapping("/privacy/export")
    @Transactional(transactionManager = "learnerTransactionManager")
    public Map<String, Object> createPrivacyExport(@RequestBody(required = false) Map<String, Object> request,
            Authentication authentication, @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal p = principal(authentication);
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key is required");
        }
        String policyName = text(request, "policyName", "learner-self");
        if (!"learner-self".equals(policyName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "policyName must be learner-self");
        }
        Map<String, Object> existing = one("""
                SELECT export_id, export_status, policy_name
                  FROM b25_learner_privacy_export
                 WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                """, TENANT, p.subject(), idempotencyKey);
        if (existing != null) {
            return privacyExportResponse(existing.get("export_id"), existing.get("export_status"), existing.get("policy_name"));
        }
        String exportId = "privacy-export-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO b25_learner_privacy_export
                    (export_id, principal_id, tenant_id, policy_name, export_status, idempotency_key, created_at)
                VALUES (?, ?, ?, ?, 'QUEUED', ?, CURRENT_TIMESTAMP(6))
                """, exportId, p.subject(), TENANT, policyName, idempotencyKey);
        return privacyExportResponse(exportId, "QUEUED", policyName);
    }

    @GetMapping("/first-day")
    public Map<String, Object> firstDay(Authentication authentication) {
        Principal p = principal(authentication);
        return envelope(firstDayData(p));
    }

    @GetMapping("/home")
    public Map<String, Object> home(Authentication authentication) {
        Principal p = principal(authentication);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("profile", profileData(p));
        data.put("firstDay", firstDayData(p));
        data.put("dailyStream", dailyStreamData(p));
        data.put("contentEpoch", 1L);
        data.put("source", "mysql");
        return envelope(data);
    }

    @PostMapping("/onboarding/daily-tasks/{taskId}/complete")
    public Map<String, Object> completeTask(@PathVariable String taskId, Authentication authentication,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal p = principal(authentication);
        int updated = jdbc.update("""
                UPDATE b25_learner_daily_task
                   SET task_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP(6), idempotency_key = ?
                 WHERE task_id = ? AND principal_id = ? AND tenant_id = ? AND task_status <> 'COMPLETED'
                """, idempotencyKey, taskId, p.subject(), TENANT);
        Map<String, Object> row = one("""
                SELECT task_id, content_code, title, task_type, minutes, task_status, task_order, completed_at
                  FROM b25_learner_daily_task WHERE task_id = ? AND principal_id = ? AND tenant_id = ?
                """, taskId, p.subject(), TENANT);
        if (row == null) throw notFound("daily task is not owned by the verified principal");
        Map<String, Object> data = new LinkedHashMap<>(row);
        data.put("replayed", updated == 0);
        data.put("dailyStream", dailyStreamData(p));
        data.put("firstDay", firstDayData(p));
        return envelope(data);
    }

    private Map<String, Object> profileData(Principal p) {
        Map<String, Object> data = profileRow(p);
        data.put("goal", goalRow(p));
        data.put("preferences", preferenceRow(p));
        data.put("source", "mysql");
        return data;
    }

    private Map<String, Object> firstDayData(Principal p) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("profile", profileRow(p));
        data.put("goal", goalRow(p));
        data.put("preferences", preferenceRow(p));
        List<Map<String, Object>> tasks = dailyTaskViews(p);
        data.put("tasks", tasks);
        data.put("state", goalRow(p).isEmpty() || tasks.isEmpty() ? "NOT_READY" : "READY");
        data.put("profileReady", !profileRow(p).isEmpty());
        data.put("targetReady", !goalRow(p).isEmpty());
        data.put("placementStatus", "NOT_STARTED");
        data.put("taskCount", tasks.size());
        data.put("contentEpoch", 1L);
        data.put("projectionVersion", 1L);
        data.put("source", "mysql");
        return data;
    }

    private Map<String, Object> dailyStreamData(Principal p) {
        List<Map<String, Object>> tasks = dailyTaskViews(p);
        int targetMinutes = integerValue(goalRow(p).get("daily_quota_minutes"), 0);
        int completedMinutes = tasks.stream()
                .filter(task -> Boolean.TRUE.equals(task.get("completed")))
                .mapToInt(task -> integerValue(task.get("minutes"), 0))
                .sum();
        long available = tasks.stream().filter(task -> !Boolean.TRUE.equals(task.get("completed"))).count();
        Map<String, Object> stream = new LinkedHashMap<>();
        stream.put("dueNewCount", available);
        stream.put("dueReviewCount", 0);
        stream.put("mistakeCount", 0);
        stream.put("completedMinutes", completedMinutes);
        stream.put("targetMinutes", targetMinutes);
        stream.put("tasks", tasks);
        stream.put("lastSyncedAt", java.time.Instant.now().toString());
        return stream;
    }

    private List<Map<String, Object>> dailyTaskViews(Principal p) {
        return jdbc.queryForList("""
                SELECT task_id, content_code, title, task_type, minutes, task_status, task_order, completed_at
                  FROM b25_learner_daily_task WHERE principal_id = ? AND tenant_id = ?
                 ORDER BY task_order, task_id
                """, p.subject(), TENANT).stream().map(row -> {
                    Map<String, Object> task = new LinkedHashMap<>();
                    task.put("id", row.get("task_id"));
                    task.put("taskId", row.get("task_id"));
                    task.put("contentCode", row.get("content_code"));
                    task.put("title", row.get("title"));
                    task.put("description", "来自已发布内容投影：" + row.get("content_code"));
                    task.put("kind", "NEW");
                    task.put("taskType", row.get("task_type"));
                    task.put("minutes", row.get("minutes"));
                    task.put("count", 1);
                    task.put("completed", "COMPLETED".equals(String.valueOf(row.get("task_status"))));
                    task.put("status", row.get("task_status"));
                    task.put("taskOrder", row.get("task_order"));
                    task.put("completedAt", row.get("completed_at"));
                    return task;
                }).toList();
    }

    private Map<String, Object> profileRow(Principal p) {
        Map<String, Object> row = one("""
                SELECT principal_id, status, nickname, accent_pref, birth_year, age_confirmed,
                       privacy_consent, terms_consent, ui_locale, content_locale, timezone,
                       theme_mode, state_version, updated_at
                  FROM b25_learner_profile WHERE principal_id = ? AND tenant_id = ?
                """, p.subject(), TENANT);
        if (row != null) return row;
        Map<String, Object> defaults = new LinkedHashMap<>();
        defaults.put("principal_id", p.subject()); defaults.put("status", "ONBOARDING");
        defaults.put("nickname", "学习者"); defaults.put("accent_pref", "US");
        defaults.put("ui_locale", "zh-CN"); defaults.put("content_locale", "en-US");
        defaults.put("timezone", "Asia/Shanghai"); defaults.put("theme_mode", "SYSTEM");
        defaults.put("state_version", 0L);
        return defaults;
    }

    private Map<String, Object> goalRow(Principal p) {
        Map<String, Object> row = one("SELECT principal_id, goal_code, target_level, daily_quota_minutes, status, updated_at FROM b25_learner_goal WHERE principal_id = ? AND tenant_id = ?", p.subject(), TENANT);
        return row == null ? new LinkedHashMap<>() : row;
    }

    private Map<String, Object> preferenceRow(Principal p) {
        Map<String, Object> row = one("SELECT principal_id, ui_locale, content_locale, timezone, theme_mode, high_contrast, motion_mode, updated_at FROM b25_learner_preferences WHERE principal_id = ? AND tenant_id = ?", p.subject(), TENANT);
        return row == null ? new LinkedHashMap<>() : row;
    }

    private static List<Map<String, Object>> optionViews(List<Map<String, Object>> rows, String type) {
        return rows.stream().filter(row -> type.equals(text(row.get("option_type")))).map(row -> {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("value", row.get("option_code"));
            view.put("code", row.get("option_code"));
            view.put("label", row.get("label"));
            view.put("description", row.get("description"));
            return view;
        }).toList();
    }

    private Map<String, Object> one(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private static Map<String, Object> envelope(Object data) { return Map.of("source", "mysql", "data", data); }

    private static Map<String, Object> privacyExportResponse(Object exportId, Object status, Object policyName) {
        return Map.of("exportId", String.valueOf(exportId), "status", String.valueOf(status),
                "redactionPolicy", String.valueOf(policyName));
    }

    private static Principal principal(Authentication authentication) {
        return new Principal(LearnerHttpPrincipals.require(authentication).subject());
    }

    private static String required(Map<String, Object> values, String key) {
        String value = text(values, key, "");
        if (value.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " is required");
        return value;
    }

    private static String boundedRequired(Map<String, Object> values, String key, int maxLength) {
        String value = required(values, key);
        if (value.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " exceeds the maximum length");
        }
        return value;
    }

    private static String text(Map<String, Object> values, String key, String fallback) {
        Object value = values == null ? null : values.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String boundedText(Map<String, Object> values, String key, String fallback, int maxLength) {
        String value = text(values, key, fallback);
        if (value.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " exceeds the maximum length");
        }
        return value;
    }

    private static String accent(Map<String, Object> values, String fallback) {
        String value = text(values, "accentPref", fallback).toUpperCase(java.util.Locale.ROOT);
        if (!"US".equals(value) && !"UK".equals(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "accentPref must be US or UK");
        }
        return value;
    }

    private static int integer(Map<String, Object> values, String key, int fallback) {
        Object value = values == null ? null : values.get(key);
        if (value instanceof Number number) return number.intValue();
        try { return value == null ? fallback : Integer.parseInt(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return fallback; }
    }

    private static int integerValue(Object value, int fallback) {
        if (value instanceof Number number) return number.intValue();
        try { return value == null ? fallback : Integer.parseInt(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return fallback; }
    }

    private static Object integerOrNull(Map<String, Object> values, String key, Object fallback) {
        Object value = values == null ? null : values.get(key);
        return value == null ? fallback : integer(values, key, 0);
    }

    private static boolean bool(Map<String, Object> values, String key, Map<String, Object> current, boolean fallback) {
        Object value = values == null ? null : values.get(key);
        if (value == null && current != null) value = current.get(key.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase());
        return value == null ? fallback : Boolean.parseBoolean(String.valueOf(value));
    }

    private static ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }
    private record Principal(String subject) { }
}
