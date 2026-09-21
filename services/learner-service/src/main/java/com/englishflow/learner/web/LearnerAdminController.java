package com.englishflow.learner.web;

import com.englishflow.learner.application.FirstDayView;
import com.englishflow.learner.application.LearnerAdminService;
import com.englishflow.learner.application.LearnerProfileView;
import com.englishflow.learner.domain.LearnerTenantScope;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Single-tenant control-plane reads and governed commands on learner facts.
 *
 * <p>Every call requires a verified tenant-admin JWT; the target subject comes
 * from the path. Writes carry Idempotency-Key and expectedVersion and emit the
 * same outbox facts as learner-owned writes, tagged with the admin actor.</p>
 */
@RestController
@RequestMapping("/internal/v1/learner/admin")
public final class LearnerAdminController {

    private final LearnerAdminService admin;

    public LearnerAdminController(LearnerAdminService admin) {
        this.admin = admin;
    }

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(
            Authentication authentication,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @RequestHeader HttpHeaders headers) {
        LearnerAdminPrincipals.requireRead(authentication);
        // Canonical pageSize wins; the pre-contract limit alias stays for transition.
        int requested = pageSize != null ? pageSize : (limit != null ? limit : 20);
        int size = Math.max(1, Math.min(requested, 100));
        String after = cursor == null ? "" : cursor.trim();
        // One-row probe so hasMore/nextCursor agree instead of guessing at exact multiples.
        List<LearnerTenantScope> rows = admin.search(q, size + 1, after);
        boolean hasMore = rows.size() > size;
        List<Map<String, Object>> items = rows.stream().limit(size)
                .map(scope -> Map.<String, Object>of(
                        "subjectId", scope.subjectId(),
                        "tenantId", scope.tenantId()))
                .toList();
        String nextCursor = hasMore ? rows.get(size - 1).subjectId() : null;
        ContentIds ids = ids(headers);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("requestId", ids.requestId());
        meta.put("traceId", ids.traceId());
        meta.put("apiVersion", "v1");
        meta.put("schemaVersion", "1.0.0");
        meta.put("serverTime", java.time.Instant.now().toString());
        meta.put("hasMore", hasMore);
        meta.put("pageSize", size);
        meta.put("nextCursor", nextCursor);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("data", items);
        body.put("meta", meta);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/subjects/{subjectId}/profile")
    public ResponseEntity<Map<String, Object>> profile(
            @PathVariable String subjectId,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        LearnerAdminPrincipals.requireRead(authentication);
        LearnerProfileView view = admin.profile(subjectId);
        Optional<FirstDayView> firstDay = admin.firstDay(subjectId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("subjectId", view.subjectId());
        data.put("profile", viewOf(view));
        firstDay.ifPresent(first -> data.put("firstDay", firstDayOf(first)));
        return ResponseEntity.ok(Map.of("data", data));
    }

    @PostMapping("/subjects/{subjectId}/commands")
    public ResponseEntity<Map<String, Object>> command(
            @PathVariable String subjectId,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        LearnerAdminService.AdminMutationResult outcome;
        Map<String, Object> input = body == null ? Map.of() : body;
        String command = text(input.get("command")).toUpperCase();
        ContentIds ids = ids(headers);
        switch (command) {
            case "SET_GOAL" -> {
                var admin = LearnerAdminPrincipals.requireWrite(authentication);
                outcome = this.admin.setGoal(
                        subjectId,
                        text(input.get("goalType")),
                        number(input.get("dailyMinutes")),
                        textOrNull(input.get("targetDate")),
                        textOrNull(input.get("startingLevel")),
                        textOrNull(input.get("examName")),
                        textOrNull(input.get("language")),
                        version(input.get("expectedStateVersion"), input.get("expectedVersion")),
                        requireKey(idempotencyKey),
                        ids.requestId(), ids.traceId(), admin.subjectId());
            }
            case "UPDATE_PREFERENCES" -> {
                var admin = LearnerAdminPrincipals.requireWrite(authentication);
                outcome = this.admin.updatePreferences(
                        subjectId,
                        text(input.get("uiLocale")),
                        text(input.get("contentLocale")),
                        text(input.get("themeMode")),
                        text(input.get("timezone")),
                        bool(input.get("reducedMotion")),
                        version(input.get("expectedStateVersion"), input.get("expectedVersion")),
                        requireKey(idempotencyKey),
                        ids.requestId(), ids.traceId(), admin.subjectId());
            }
            default -> throw new com.englishflow.learner.domain.LearnerDomainException(
                    com.englishflow.learner.domain.LearnerDecisionCode.INVALID_CONTEXT,
                    "unsupported learner admin command");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("command", command);
        data.put("subjectId", subjectId);
        data.put("profileVersion", outcome.view().version());
        data.put("replayed", outcome.replayed());
        data.put("adminSubject", outcome.adminSubject());
        data.put("status", "ACCEPTED");
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", data));
    }

    private static Map<String, Object> viewOf(LearnerProfileView view) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("profileId", view.profileId());
        result.put("tenantId", view.tenantId());
        result.put("subjectId", view.subjectId());
        result.put("source", view.source().name());
        result.put("onboardingState", view.onboardingState().name());
        result.put("assessmentState", view.assessmentState().name());
        view.currentLevel().ifPresent(level -> result.put("currentLevel", level.name()));
        view.goal().ifPresent(goal -> {
            Map<String, Object> goalView = new LinkedHashMap<>();
            goalView.put("targetId", goal.targetId());
            goalView.put("type", goal.type().name());
            goalView.put("dailyMinutes", goal.dailyStudyMinutes().minutes());
            goalView.put("startingLevel", goal.startingLevel().name());
            if (!goal.fields().isEmpty()) {
                goalView.put("fields", new LinkedHashMap<>(goal.fields()));
            }
            result.put("goal", goalView);
        });
        view.preferences().ifPresent(preferences -> result.put("preferences", Map.of(
                "uiLocale", preferences.uiLocale(),
                "contentLocale", preferences.contentLocale(),
                "themeMode", preferences.themeMode().name(),
                "timezone", preferences.timezone(),
                "reducedMotion", preferences.reducedMotion())));
        result.put("version", view.version());
        return result;
    }

    private static Map<String, Object> firstDayOf(FirstDayView first) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("todayNewItems", first.todayNewItems());
        result.put("dueReviewItems", first.dueReviewItems());
        result.put("weakItems", first.weakItems());
        result.put("completionPercent", first.completionPercent());
        result.put("nextAction", first.nextAction());
        result.put("profileVersion", first.profileVersion());
        return result;
    }

    private record ContentIds(String requestId, String traceId) {
    }

    private static ContentIds ids(HttpHeaders headers) {
        String requestId = text(headers.getFirst("X-Request-Id"));
        String traceId = text(headers.getFirst("X-Trace-Id"));
        if (requestId.length() < 8) requestId = "admin-learner-cmd";
        if (traceId.length() < 8) traceId = "0123456789abcdef0123456789abcdef";
        return new ContentIds(requestId, traceId);
    }

    private static String requireKey(String value) {
        if (value == null || value.trim().length() < 16) {
            throw new com.englishflow.learner.domain.LearnerDomainException(
                    com.englishflow.learner.domain.LearnerDecisionCode.INVALID_CONTEXT,
                    "Idempotency-Key is required");
        }
        return value.trim();
    }

    private static String text(Object value) {
        return value instanceof String string ? string.trim() : "";
    }

    private static String textOrNull(Object value) {
        String text = text(value);
        return text.isEmpty() ? null : text;
    }

    private static int number(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        throw new com.englishflow.learner.domain.LearnerDomainException(
                com.englishflow.learner.domain.LearnerDecisionCode.INVALID_GOAL,
                "dailyMinutes must be a number");
    }

    /**
     * Contract field {@code expectedStateVersion}; the pre-contract {@code expectedVersion}
     * alias is accepted for backward compatibility. A present-but-unparseable value is
     * rejected instead of silently dropping the optimistic-concurrency guard.
     */
    private static Long version(Object primary, Object legacy) {
        Object value = primary == null ? legacy : primary;
        if (value == null) {
            return null;
        }
        if (value instanceof Number number && number.longValue() >= 0) {
            return number.longValue();
        }
        throw new com.englishflow.learner.domain.LearnerDomainException(
                com.englishflow.learner.domain.LearnerDecisionCode.INVALID_CONTEXT,
                "expectedStateVersion must be a non-negative integer");
    }

    private static boolean bool(Object value) {
        return value instanceof Boolean bool ? bool : "true".equalsIgnoreCase(text(value));
    }
}
