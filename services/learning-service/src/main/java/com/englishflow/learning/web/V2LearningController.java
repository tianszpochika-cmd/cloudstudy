package com.englishflow.learning.web;

import com.englishflow.learning.application.PlanDayFacts;

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
        String subject = LearningHttpPrincipals.require(authentication, "learning.plan.read").subject();
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
        data.put("firstLearning", firstLearning(subject, plan));
        return Map.of("data", data);
    }

    /** Today queue for the verified owner: due SRS items, owner-scoped, due-ordered. */
    @GetMapping("/today")
    public Map<String, Object> today(Authentication authentication) {
        String subject = LearningHttpPrincipals.require(authentication, "learning.review.read").subject();
        List<Map<String, Object>> items = todayItems(subject);
        Map<String, Object> plan = currentPlanRow(subject);
        QueueFacts facts = queueFacts(subject);
        boolean hasPlan = !"EMPTY".equals(plan.get("status"));
        String emptyReason = PlanDayFacts.emptyReason(hasPlan, facts.openDue(), facts.total(), facts.unfinished());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("principalId", subject);
        data.put("planId", plan.get("planId"));
        data.put("status", plan.get("status"));
        data.put("planVersion", plan.get("planVersion"));
        data.put("targetMinutes", plan.get("targetMinutes"));
        data.put("count", items.size());
        data.put("items", items.stream().limit(50).toList());
        data.put("emptyReason", emptyReason);
        data.put("firstLearning", firstLearning(subject, plan));
        if (!facts.explanation().isBlank()) {
            data.put("explanation", facts.explanation());
            data.put("explanationPinVersion", facts.explanationPinVersion());
        }
        data.put("generatedAt", Instant.now().toString());
        return Map.of("data", data);
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
                SELECT item_id, stage, due_at, practice_ref_json
                  FROM b25_learning_srs_state
                 WHERE principal_id = ? AND tenant_id = ? AND due_at <= CURRENT_TIMESTAMP(6)
                 ORDER BY due_at, item_id
                 LIMIT 100
                """, subject, TENANT).stream().map(row -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("itemId", String.valueOf(row.get("item_id")));
                    item.put("stage", String.valueOf(row.get("stage")));
                    item.put("dueAt", String.valueOf(row.get("due_at")));
                    Map<String, Object> ref = practiceRef(row.get("practice_ref_json"));
                    if (ref != null) item.put("practiceRef", ref);
                    return Map.copyOf(item);
                }).toList();
    }

    private record QueueFacts(int openDue, int unfinished, int total, String explanation, long explanationPinVersion) {
    }

    private QueueFacts queueFacts(String subject) {
        Map<String, Object> counts = jdbc.queryForMap("""
                SELECT COALESCE(SUM(CASE WHEN due_at <= CURRENT_TIMESTAMP(6)
                          AND (stage = 'NEW' OR review_count = 0) THEN 1 ELSE 0 END), 0) AS open_due,
                       COALESCE(SUM(CASE WHEN stage = 'NEW' OR review_count = 0 THEN 1 ELSE 0 END), 0) AS unfinished,
                       COUNT(*) AS total_rows
                  FROM b25_learning_srs_state
                 WHERE principal_id = ? AND tenant_id = ?
                """, subject, TENANT);
        List<Map<String, Object>> explanation = jdbc.queryForList("""
                SELECT explanation_text, pin_version FROM learning_plan_input_snapshot
                 WHERE tenant_id = ? AND principal_id = ?
                 ORDER BY created_at DESC, pin_version DESC
                 LIMIT 1
                """, TENANT, subject);
        String text = "";
        long pinVersion = 0L;
        if (!explanation.isEmpty()) {
            Object stored = explanation.getFirst().get("explanation_text");
            text = stored == null ? "" : String.valueOf(stored);
            if (explanation.getFirst().get("pin_version") instanceof Number number) {
                pinVersion = number.longValue();
            }
        }
        return new QueueFacts(count(counts.get("open_due")), count(counts.get("unfinished")),
                count(counts.get("total_rows")), text, pinVersion);
    }

    private Map<String, Object> firstLearning(String subject, Map<String, Object> plan) {
        boolean hasPlan = !"EMPTY".equals(plan.get("status"));
        List<Map<String, Object>> first = jdbc.queryForList("""
                SELECT stage, review_count FROM b25_learning_srs_state
                 WHERE principal_id = ? AND tenant_id = ?
                 ORDER BY item_id
                 LIMIT 1
                """, subject, TENANT);
        boolean hasTask = !first.isEmpty();
        boolean open = false;
        if (hasTask) {
            String stage = String.valueOf(first.getFirst().get("stage"));
            int reviews = count(first.getFirst().get("review_count"));
            open = "NEW".equals(stage) && reviews == 0;
        }
        String reason = PlanDayFacts.firstLearningReason(hasPlan, hasTask, open);
        return Map.of(
                "guideVisible", PlanDayFacts.firstLearningGuideVisible(reason),
                "reason", reason);
    }

    private static int count(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    private static final tools.jackson.databind.ObjectMapper REF_READER =
            new tools.jackson.databind.ObjectMapper();

    private static Map<String, Object> practiceRef(Object raw) {
        if (!(raw instanceof String json) || json.isBlank()) return null;
        try {
            Object decoded = REF_READER.readValue(json, Object.class);
            if (!(decoded instanceof Map<?, ?> map)) return null;
            if (!(map.get("contentCode") instanceof String code) || code.isBlank()
                    || !(map.get("contentVersionId") instanceof Number version)
                    || !(map.get("questionItemId") instanceof String question)
                    || question.isBlank()) {
                return null;
            }
            Map<String, Object> ref = new LinkedHashMap<>();
            ref.put("contentCode", code);
            ref.put("contentVersionId", version.longValue());
            ref.put("questionItemId", question);
            return Map.copyOf(ref);
        } catch (Exception invalid) {
            return null;
        }
    }
}
