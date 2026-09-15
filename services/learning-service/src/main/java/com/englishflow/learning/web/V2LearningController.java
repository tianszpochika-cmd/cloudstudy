package com.englishflow.learning.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * M4-008 v2 HTTP adapter for the first-day projection.
 *
 * <p>The B25/B3 controllers remain as JDBC残留 for their own modes. This adapter is the v2
 * read boundary for learn-home/today/plan-map/course-shelf: verified JWT only (platform
 * tenant, learner role, permissions), owner-scoped reads against the same durable runtime
 * tables, empty (not 404) when the learner has no plan yet, and plan/target versions echoed
 * so clients can reconcile. Full LearningPlanService orchestration across learner/content
 * ports stays behind the domain mode flag and is not re-implemented here.</p>
 */
@RestController
@RequestMapping("/api/v1/learning")
@ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "jdbc")
public class V2LearningController {

    private static final String TENANT = "platform";

    private final JdbcTemplate jdbc;

    public V2LearningController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * First-day projection: plan (or EMPTY), today queue, map entry points and shelf entry.
     * Canonical route for PAGE-P1-LEARN-HOME/TODAY/PLAN-MAP/COURSE-SHELF reconciliation.
     */
    @GetMapping("/first-day")
    public Map<String, Object> firstDay(Authentication authentication) {
        String subject = LearningHttpPrincipals.require(authentication).subject();
        Map<String, Object> plan = currentPlanRow(subject);
        List<Map<String, Object>> today = todayItems(subject);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("principalId", subject);
        data.put("plan", plan);
        data.put("today", Map.of("count", today.size(), "items", today.stream().limit(20).toList()));
        data.put("planMap", List.of(
                Map.of("node", "TODAY", "route", "/today", "available", true),
                Map.of("node", "PLAN", "route", "/home", "available", !plan.get("status").equals("EMPTY")),
                Map.of("node", "COURSE_SHELF", "route", "/learn/session", "available", !plan.get("status").equals("EMPTY"))));
        data.put("courseShelf", Map.of(
                "entry", "/learn/session",
                "available", !plan.get("status").equals("EMPTY"),
                "reasonCode", plan.get("status").equals("EMPTY") ? "PLAN_EMPTY" : "ALLOWED"));
        data.put("versions", Map.of(
                "planVersion", plan.get("planVersion"),
                "targetMinutes", plan.get("targetMinutes"),
                "generatedAt", Instant.now().toString(),
                "source", "learning-service:owner-db"));
        return Map.of("data", data);
    }

    /** Today queue for the verified owner: due SRS items, owner-scoped, due-ordered. */
    @GetMapping("/today")
    public Map<String, Object> today(Authentication authentication) {
        String subject = LearningHttpPrincipals.require(authentication).subject();
        List<Map<String, Object>> items = todayItems(subject);
        Map<String, Object> plan = currentPlanRow(subject);
        return Map.of("data", Map.of(
                "principalId", subject,
                "planVersion", plan.get("planVersion"),
                "targetMinutes", plan.get("targetMinutes"),
                "count", items.size(),
                "items", items.stream().limit(50).toList(),
                "generatedAt", Instant.now().toString()));
    }

    private Map<String, Object> currentPlanRow(String subject) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT plan_id, status, target_minutes, plan_version FROM b25_learning_plan WHERE principal_id = ? AND tenant_id = ?",
                subject, TENANT);
        if (rows.isEmpty()) {
            return Map.of("status", "EMPTY", "planId", "", "targetMinutes", 0, "planVersion", 0);
        }
        Map<String, Object> row = rows.get(0);
        return Map.of(
                "status", String.valueOf(row.get("status")),
                "planId", String.valueOf(row.get("plan_id")),
                "targetMinutes", row.get("target_minutes") instanceof Number n ? n.intValue() : 0,
                "planVersion", row.get("plan_version") instanceof Number n ? n.longValue() : 0L);
    }

    private List<Map<String, Object>> todayItems(String subject) {
        return jdbc.queryForList("""
                SELECT item_id, stage, due_at
                  FROM b25_learning_srs_state
                 WHERE principal_id = ? AND tenant_id = ? AND due_at <= CURRENT_TIMESTAMP(6)
                 ORDER BY due_at, item_id
                 LIMIT 100
                """, subject, TENANT).stream().map(row -> Map.<String, Object>of(
                        "itemId", String.valueOf(row.get("item_id")),
                        "stage", String.valueOf(row.get("stage")),
                        "dueAt", String.valueOf(row.get("due_at")))).toList();
    }
}
