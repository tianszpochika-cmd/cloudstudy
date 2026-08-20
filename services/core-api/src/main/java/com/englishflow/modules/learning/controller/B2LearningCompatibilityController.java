package com.englishflow.modules.learning.controller;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.modules.assessment.b2.B2AssessmentEngine;
import com.englishflow.modules.assessment.b2.B2AssessmentException;
import com.englishflow.modules.learning.vocabulary.VocabularyService;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import com.englishflow.modules.user.api.UserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/")
public final class B2LearningCompatibilityController {
    private final VocabularyService vocabulary;
    private final B2AssessmentEngine assessment;
    private final UserContextResolver contextResolver;

    public B2LearningCompatibilityController(VocabularyService vocabulary,
                                              B2AssessmentEngine assessment,
                                              UserContextResolver contextResolver) {
        this.vocabulary = vocabulary;
        this.assessment = assessment;
        this.contextResolver = contextResolver;
    }

    @GetMapping("/learning/plan/current")
    public Map<String, Object> currentPlan(@RequestHeader(value = "X-Timezone", required = false, defaultValue = "Asia/Shanghai") String timezone,
                                           HttpServletRequest request) {
        UserRequestContext context = context(request);
        Map<String, Object> overview = vocabulary.overview(context, timezone);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("planCode", "CURRENT");
        data.put("srsOverview", overview.get("data"));
        return envelope(context, data);
    }

    @GetMapping("/learning/stream/today")
    public Map<String, Object> todayStream(@RequestParam(required = false) String date,
                                           @RequestParam(defaultValue = "15") int targetCount,
                                           @RequestHeader(value = "Idempotency-Key", required = false) String key,
                                           HttpServletRequest request) {
        return assessment.dailyStream(user(request), date == null ? null : LocalDate.parse(date), targetCount, key);
    }

    @PostMapping("/learning/stream/action")
    public Map<String, Object> streamAction(@RequestBody Map<String, Object> body,
                                             @RequestHeader("Idempotency-Key") String key,
                                             @RequestHeader(value = "X-Timezone", required = false, defaultValue = "Asia/Shanghai") String timezone,
                                             HttpServletRequest request) {
        if (body != null && body.get("exerciseId") != null && sessionId(body) != null) {
            return assessment.submitAssessmentAnswer(user(request), sessionId(body), body, key);
        }
        if (body == null || body.get("snapshotId") == null || body.get("snapshotItemId") == null || !(body.get("item") instanceof Map<?, ?>)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "learning stream action requires session exercise scope or SRS snapshot scope");
        }
        Map<String, Object> review = new LinkedHashMap<>(body);
        if (!review.containsKey("rawQuality") && review.get("responseQuality") != null) review.put("rawQuality", review.get("responseQuality"));
        review.putIfAbsent("answerOutcome", "ANSWERED");
        review.putIfAbsent("clientOccurredAt", java.time.Instant.now().toString());
        review.putIfAbsent("baseStateVersion", 0L);
        review.putIfAbsent("clientEventId", "compat-" + key);
        return vocabulary.submitReview(context(request), key, review, timezone);
    }

    @GetMapping("/learning/mistakes/queue")
    public Map<String, Object> mistakeQueue(@RequestParam Map<String, String> filters, HttpServletRequest request) {
        return assessment.listMistakes(user(request), filters);
    }

    @PostMapping("/learning/mistakes/verify")
    public Map<String, Object> verifyMistake(@RequestBody Map<String, Object> body,
                                              @RequestHeader("Idempotency-Key") String key,
                                              HttpServletRequest request) {
        if (body == null) throw new B2AssessmentException("ASM_SCHEMA_INVALID", "verification body is required", 400, false);
        long verificationId = longValue(body.get("verificationId"), 0L);
        Map<String, Object> submission = new LinkedHashMap<>(body);
        if (verificationId == 0L) {
            long mistakeId = longValue(body.get("mistakeId"), 0L);
            if (mistakeId == 0L) throw new B2AssessmentException("ASM_SCHEMA_INVALID", "mistakeId is required", 400, false);
            Map<String, Object> started = assessment.startMistakeRetry(user(request), mistakeId, key);
            verificationId = longValue(started.get("verificationId"), 0L);
            submission.putIfAbsent("stage", started.get("stage"));
        }
        submission.putIfAbsent("clientSubmissionId", key);
        return assessment.submitVerification(user(request), verificationId, submission, key);
    }

    @GetMapping("/learning/stats/daily-summary")
    public Map<String, Object> dailySummary(@RequestParam(required = false) String date, HttpServletRequest request) {
        return assessment.dailyReport(user(request), date == null ? null : LocalDate.parse(date));
    }

    @GetMapping("/notifications")
    public Map<String, Object> notifications(@RequestParam(required = false) String status,
                                              @RequestParam(defaultValue = "20") int limit,
                                              HttpServletRequest request) {
        UserRequestContext context = context(request);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", java.util.List.of());
        data.put("unreadCount", 0);
        data.put("nextCursor", null);
        data.put("statusFilter", status == null ? "ALL" : status);
        data.put("limit", Math.max(1, Math.min(50, limit)));
        return envelope(context, data);
    }

    private UserRequestContext context(HttpServletRequest request) { return contextResolver.resolve(request); }

    private static long user(HttpServletRequest request) {
        Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) return context.userId();
        throw new B2AssessmentException("ASM_AUTH_REQUIRED", "需要登录", 401, false);
    }

    private static String sessionId(Map<String, Object> body) {
        if (body == null) return null;
        Object value = body.get("sessionUuid");
        if (value == null || String.valueOf(value).isBlank()) value = body.get("sessionId");
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value);
    }

    private static long longValue(Object value, long fallback) {
        try { return value == null ? fallback : Long.parseLong(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return fallback; }
    }

    private static Map<String, Object> envelope(UserRequestContext context, Map<String, Object> data) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestId", context.requestId());
        result.put("data", data);
        return result;
    }

    @RestControllerAdvice(assignableTypes = B2LearningCompatibilityController.class)
    public static final class ExceptionAdvice {
        @ExceptionHandler(B2AssessmentException.class)
        public ResponseEntity<Map<String, Object>> handle(B2AssessmentException exception, HttpServletRequest request) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("errorCode", exception.code());
            error.put("message", exception.getMessage());
            error.put("retryable", exception.retryable());
            String requestId = request.getHeader("X-Request-Id");
            return ResponseEntity.status(exception.status()).body(Map.of("requestId", requestId == null ? "req_b2_error" : requestId, "error", error));
        }
    }
}
