package com.englishflow.modules.assessment.controller;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.modules.assessment.b2.B2AssessmentEngine;
import com.englishflow.modules.assessment.b2.B2AssessmentException;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestController
@RequestMapping("/")
public final class AssessmentB2Controller {
    private final B2AssessmentEngine engine;

    public AssessmentB2Controller(B2AssessmentEngine engine) { this.engine = engine; }

    @GetMapping("/assessment/daily-stream")
    public Map<String, Object> dailyStream(@RequestParam(required = false) String date,
                                           @RequestParam(defaultValue = "15") int targetCount,
                                           @RequestHeader(value = "Idempotency-Key", required = false) String key,
                                           HttpServletRequest request) {
        return engine.dailyStream(user(request), date == null ? null : LocalDate.parse(date), targetCount, key);
    }

    @PostMapping("/assessment/sessions")
    public Map<String, Object> createAssessment(@RequestBody Map<String, Object> body,
                                                @RequestHeader("Idempotency-Key") String key,
                                                HttpServletRequest request) { return engine.createAssessmentSession(user(request), body, key); }

    @GetMapping("/assessment/sessions/{sessionId}")
    public Map<String, Object> assessmentSession(@PathVariable String sessionId, HttpServletRequest request) { return engine.getSession(user(request), sessionId); }

    @PostMapping("/assessment/sessions/{sessionId}/answers")
    public Map<String, Object> assessmentAnswer(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                                @RequestHeader(value = "Idempotency-Key", required = false) String key,
                                                HttpServletRequest request) { return engine.submitAssessmentAnswer(user(request), sessionId, body, key); }

    @PutMapping("/assessment/sessions/{sessionId}/checkpoint")
    public Map<String, Object> assessmentCheckpoint(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                                    @RequestHeader("Idempotency-Key") String key,
                                                    HttpServletRequest request) { return engine.saveCheckpoint(user(request), sessionId, body, key); }

    @PostMapping("/assessment/sessions/{sessionId}/complete")
    public Map<String, Object> assessmentComplete(@PathVariable String sessionId,
                                                  @RequestHeader("Idempotency-Key") String key,
                                                  HttpServletRequest request) { return engine.completeAssessment(user(request), sessionId, key); }

    @PostMapping("/assessment/session/start")
    public ResponseEntity<Map<String, Object>> legacyAssessmentStart(@RequestBody Map<String, Object> body,
                                                                      @RequestHeader("Idempotency-Key") String key,
                                                                      HttpServletRequest request) {
        return ResponseEntity.status(201).body(engine.createAssessmentSession(user(request), body, key));
    }

    @PostMapping("/assessment/session/answer-item")
    public Map<String, Object> legacyAssessmentAnswer(@RequestBody Map<String, Object> body,
                                                       @RequestHeader("Idempotency-Key") String key,
                                                       HttpServletRequest request) {
        return engine.submitAssessmentAnswer(user(request), requiredSessionId(body), body, key);
    }

    @PostMapping("/assessment/session/submit")
    public Map<String, Object> legacyAssessmentSubmit(@RequestBody Map<String, Object> body,
                                                       @RequestHeader("Idempotency-Key") String key,
                                                       HttpServletRequest request) {
        return engine.completeAssessment(user(request), requiredSessionId(body), key);
    }

    @GetMapping("/assessment/report/{sessionUuid}")
    public Map<String, Object> legacyAssessmentReport(@PathVariable String sessionUuid, HttpServletRequest request) {
        return engine.assessmentReport(user(request), sessionUuid);
    }

    @GetMapping("/exam/papers")
    public Map<String, Object> papers(@RequestParam(required = false) String examCode) { return engine.listPapers(examCode); }

    @GetMapping("/exam/papers/{paperId}")
    public Map<String, Object> paper(@PathVariable long paperId) { return engine.getPaper(paperId); }

    @PostMapping("/exam/sessions")
    public Map<String, Object> createExam(@RequestBody Map<String, Object> body,
                                          @RequestHeader("Idempotency-Key") String key,
                                          HttpServletRequest request) { return engine.createExamSession(user(request), body, key); }

    @GetMapping("/exam/sessions/{sessionId}")
    public Map<String, Object> examSession(@PathVariable String sessionId, HttpServletRequest request) { return engine.getExamSession(user(request), sessionId); }

    @PostMapping("/exam/sessions/{sessionId}/heartbeat")
    public Map<String, Object> heartbeat(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                        @RequestHeader("Idempotency-Key") String key,
                                        HttpServletRequest request) { return engine.examHeartbeat(user(request), sessionId, body, key); }

    @PostMapping("/exam/sessions/{sessionId}/anti-cheat-events")
    public ResponseEntity<Map<String, Object>> antiCheat(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                                         @RequestHeader(value = "Idempotency-Key", required = false) String key,
                                                         HttpServletRequest request) { return ResponseEntity.accepted().body(engine.recordAntiCheatEvent(user(request), sessionId, body, key)); }

    @GetMapping("/exam/sessions/{sessionId}/answer-sheet")
    public Map<String, Object> answerSheet(@PathVariable String sessionId, HttpServletRequest request) { return engine.examAnswerSheet(user(request), sessionId); }

    @PostMapping("/exam/sessions/{sessionId}/answer-sheet/marks")
    public Map<String, Object> answerSheetMark(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                               @RequestHeader("Idempotency-Key") String key,
                                               HttpServletRequest request) { return engine.updateAnswerSheetMark(user(request), sessionId, body, key); }

    @PutMapping("/exam/sessions/{sessionId}/checkpoint")
    public Map<String, Object> examCheckpoint(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                              @RequestHeader("Idempotency-Key") String key,
                                              HttpServletRequest request) { return engine.saveExamCheckpoint(user(request), sessionId, body, key); }

    @PostMapping("/exam/sessions/{sessionId}/answers")
    public ResponseEntity<Map<String, Object>> examAnswer(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                                          @RequestHeader(value = "Idempotency-Key", required = false) String key,
                                                          HttpServletRequest request) { return ResponseEntity.accepted().body(engine.submitExamAnswer(user(request), sessionId, body, key)); }

    @PostMapping("/exam/sessions/{sessionId}/submit")
    public Map<String, Object> submitExam(@PathVariable String sessionId,
                                           @RequestHeader("Idempotency-Key") String key,
                                           HttpServletRequest request) { return engine.submitExam(user(request), sessionId, key); }

    @GetMapping("/exam/sessions/{sessionId}/report")
    public Map<String, Object> examReport(@PathVariable String sessionId, HttpServletRequest request) { return engine.getExamReport(user(request), sessionId); }

    @GetMapping("/exam/history")
    public Map<String, Object> examHistory(@RequestParam(required = false) String examCode, HttpServletRequest request) { return engine.examHistory(user(request), examCode); }

    @GetMapping("/mastery/overview")
    public Map<String, Object> masteryOverview(HttpServletRequest request) { return engine.masteryOverview(user(request)); }

    @GetMapping("/mastery/mistakes")
    public Map<String, Object> mistakes(@RequestParam Map<String, String> filters, HttpServletRequest request) { return engine.listMistakes(user(request), filters); }

    @GetMapping("/mastery/mistakes/{mistakeId}")
    public Map<String, Object> mistake(@PathVariable long mistakeId, HttpServletRequest request) { return engine.getMistake(user(request), mistakeId); }

    @PostMapping("/mastery/mistakes/{mistakeId}/retry")
    public ResponseEntity<Map<String, Object>> retry(@PathVariable long mistakeId,
                                                     @RequestHeader("Idempotency-Key") String key,
                                                     HttpServletRequest request) { return ResponseEntity.status(201).body(engine.startMistakeRetry(user(request), mistakeId, key)); }

    @GetMapping("/mastery/verifications")
    public Map<String, Object> verifications(@RequestParam(required = false) String stage,
                                             @RequestParam(required = false) String result,
                                             HttpServletRequest request) { return engine.listVerifications(user(request), stage, result); }

    @PostMapping("/mastery/verifications/{verificationId}/submit")
    public Map<String, Object> submitVerification(@PathVariable long verificationId, @RequestBody Map<String, Object> body,
                                                   @RequestHeader(value = "Idempotency-Key", required = false) String key,
                                                   HttpServletRequest request) { return engine.submitVerification(user(request), verificationId, body, key); }

    @GetMapping("/mastery/reports/daily")
    public Map<String, Object> dailyReport(@RequestParam(required = false) String date, HttpServletRequest request) { return engine.dailyReport(user(request), date == null ? null : LocalDate.parse(date)); }

    @GetMapping("/mastery/reports/weekly")
    public Map<String, Object> weeklyReport(@RequestParam String weekStart, HttpServletRequest request) { return engine.weeklyReport(user(request), LocalDate.parse(weekStart)); }

    @PostMapping("/mastery/share-assets")
    public ResponseEntity<Map<String, Object>> shareAsset(@RequestBody Map<String, Object> body,
                                                          @RequestHeader("Idempotency-Key") String key,
                                                          HttpServletRequest request) { return ResponseEntity.status(201).body(engine.createShareAsset(user(request), body, key)); }

    private static long user(HttpServletRequest request) {
        Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) return context.userId();
        throw new B2AssessmentException("ASM_AUTH_REQUIRED", "需要登录", 401, false);
    }

    private static String requiredSessionId(Map<String, Object> body) {
        if (body == null) throw new B2AssessmentException("ASM_SCHEMA_INVALID", "sessionUuid is required", 400, false);
        Object value = body.get("sessionUuid");
        if (value == null || String.valueOf(value).isBlank()) value = body.get("sessionId");
        if (value == null || String.valueOf(value).isBlank()) {
            throw new B2AssessmentException("ASM_SCHEMA_INVALID", "sessionUuid is required", 400, false);
        }
        return String.valueOf(value);
    }

    @RestControllerAdvice(assignableTypes = AssessmentB2Controller.class)
    public static final class ExceptionAdvice {
        @ExceptionHandler(B2AssessmentException.class)
        public ResponseEntity<Map<String, Object>> handle(B2AssessmentException exception, HttpServletRequest request) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("errorCode", exception.code());
            error.put("message", exception.getMessage());
            error.put("retryable", exception.retryable());
            return ResponseEntity.status(exception.status()).body(Map.of("requestId", request.getHeader("X-Request-Id") == null ? "req_b2_error" : request.getHeader("X-Request-Id"), "error", error));
        }
    }
}
