package com.englishflow.assessment;

import com.englishflow.assessment.adapter.memory.InMemoryAssessmentOutbox;
import com.englishflow.assessment.application.AssessmentCommandService;
import com.englishflow.assessment.domain.AssessmentDomainException;
import com.englishflow.assessment.domain.AssessmentPrincipal;
import com.englishflow.assessment.domain.AssessmentSessionType;
import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.domain.QuestionType;
import com.englishflow.assessment.port.ContentSnapshotPort;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

/**
 * Dependency-free B10-ASM-002 smoke test.
 *
 * <p>Run it with javac/java only. It deliberately exercises the application boundary rather than
 * a Spring context so the authority, snapshot, scoring and learner-payload guarantees remain
 * testable before the durable adapters are wired.</p>
 */
public final class AssessmentDomainSmoke {
    private static final String CHECKPOINT_HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private AssessmentDomainSmoke() { }

    public static void main(String[] args) {
        AssessmentPrincipal alice = AssessmentPrincipal.authenticated("prn_assessment000001", "platform");
        AssessmentPrincipal bob = AssessmentPrincipal.authenticated("prn_assessment000002", "platform");
        ContentSnapshotPort content = AssessmentDomainSmoke::snapshot;
        MutableClock clock = new MutableClock(Instant.parse("2026-08-22T00:00:00Z"));
        InMemoryAssessmentOutbox outbox = new InMemoryAssessmentOutbox();
        AssessmentCommandService service = new AssessmentCommandService(content, outbox, clock);

        Map<String, Object> created = service.createSession(alice, createCommand(null, "create-b10-main"));
        Map<String, Object> sessionData = data(created);
        String sessionId = (String) sessionData.get("sessionId");
        Map<?, ?> firstExercise = (Map<?, ?>) ((List<?>) sessionData.get("exercises")).get(0);
        long exerciseId = ((Number) firstExercise.get("exerciseId")).longValue();
        require(exerciseId > 0, "session must expose an exercise id");

        service.startSession(alice, sessionId, "start-b10-main", "req-start-main", "trace-start-main");
        service.saveCheckpoint(alice, new AssessmentCommandService.CheckpointCommand(
                sessionId, 1, exerciseId, CHECKPOINT_HASH, 120, "checkpoint-b10-main-1",
                "req-checkpoint-1", "trace-checkpoint-1"));
        Map<String, Object> replayedCheckpoint = service.saveCheckpoint(alice, new AssessmentCommandService.CheckpointCommand(
                sessionId, 1, exerciseId, CHECKPOINT_HASH, 120, "checkpoint-b10-main-2",
                "req-checkpoint-2", "trace-checkpoint-2"));
        requireEquals(1L, ((Number) replayedCheckpoint.get("checkpointSeq")).longValue(),
                "same checkpoint sequence and hash must replay");

        service.interruptSession(alice, sessionId, "req-interrupt-main", "trace-interrupt-main");
        Map<String, Object> resumed = service.resumeSession(alice, sessionId, "req-resume-main", "trace-resume-main");
        requireEquals("IN_PROGRESS", data(resumed).get("status"), "interrupted session must resume");
        requireEquals(1L, ((Number) data(resumed).get("lastCheckpointSeq")).longValue(),
                "resume must retain the checkpoint");

        AssessmentCommandService.SubmitAnswerCommand answer = answerCommand(
                sessionId, exerciseId, "client-submission-b10-main", 1,
                "answer-b10-main", "req-answer-main", "trace-answer-main", "B");
        Map<String, Object> scored = service.submitAnswer(alice, answer);
        requireEquals("SCORED", scored.get("scoringStatus"), "server rule scoring must be authoritative");
        requireEquals(Boolean.TRUE, scored.get("isCorrect"), "the frozen content rule must score the answer");
        requireEquals(1L, ((Number) scored.get("score")).longValue(), "correct choice must earn max score");
        assertLearnerPayloadDoesNotLeakAnswers(scored);

        Map<String, Object> idempotentReplay = service.submitAnswer(alice, answer);
        requireEquals(scored.get("submissionId"), idempotentReplay.get("submissionId"),
                "same idempotency key must return the original result");
        Map<String, Object> clientReplay = service.submitAnswer(alice, answerCommand(
                sessionId, exerciseId, "client-submission-b10-main", 1,
                "answer-b10-main-retry", "req-answer-retry", "trace-answer-retry", "B"));
        requireEquals(scored.get("submissionId"), clientReplay.get("submissionId"),
                "same client submission must not create a second attempt");
        requireEquals(1L, outbox.events().stream().filter(event -> event.eventName().equals("attempt.saved.v1")).count(),
                "the in-memory outbox dedupe key must prevent duplicate attempt events");

        expectCode("ASM_IDEMPOTENCY_KEY_REUSE", () -> service.submitAnswer(alice, answerCommand(
                sessionId, exerciseId, "client-submission-b10-other", 1,
                "answer-b10-main", "req-answer-conflict", "trace-answer-conflict", "A")));

        Map<String, Object> reportResponse = service.completeSession(alice, sessionId, "complete-b10-main",
                "req-complete-main", "trace-complete-main");
        Map<String, Object> report = data(reportResponse);
        requireEquals("READY", report.get("status"), "completed session must have a report snapshot");
        requireEquals(1L, ((Number) report.get("score")).longValue(), "report must replay the authoritative score");
        requireEquals(report, data(service.getReport(alice, sessionId)), "report reads must be snapshot-stable");
        expectCode("ASM_FORBIDDEN", () -> service.getSession(bob, sessionId));
        assertOutboxDoesNotLeakAnswers(outbox);

        MutableClock timeoutClock = new MutableClock(Instant.parse("2026-08-22T01:00:00Z"));
        InMemoryAssessmentOutbox timeoutOutbox = new InMemoryAssessmentOutbox();
        AssessmentCommandService timeoutService = new AssessmentCommandService(content, timeoutOutbox, timeoutClock);
        Map<String, Object> timeoutCreated = timeoutService.createSession(alice, createCommand(1L, "create-b10-timeout"));
        String timeoutSessionId = (String) data(timeoutCreated).get("sessionId");
        long timeoutExerciseId = ((Number) ((Map<?, ?>) ((List<?>) data(timeoutCreated).get("exercises")).get(0)).get("exerciseId")).longValue();
        timeoutService.startSession(alice, timeoutSessionId, "start-b10-timeout", "req-start-timeout", "trace-start-timeout");
        timeoutClock.advance(Duration.ofSeconds(2));
        requireEquals("AUTO_SUBMITTED", data(timeoutService.getSession(alice, timeoutSessionId)).get("status"),
                "deadline must auto-submit on the next command/read");
        requireEquals("READY", data(timeoutService.getReport(alice, timeoutSessionId)).get("status"),
                "auto-submit must create a replayable report");
        Map<String, Object> late = timeoutService.submitAnswer(alice, answerCommand(
                timeoutSessionId, timeoutExerciseId, "client-submission-b10-late", 1,
                "answer-b10-late", "req-answer-late", "trace-answer-late", "B"));
        requireEquals("LATE", late.get("scoringStatus"), "answers after deadline must not be scored");
        requireEquals(Boolean.FALSE, late.get("accepted"), "late answers must be rejected by the service");

        System.out.println("assessment-service B10 smoke: PASS");
    }

    private static AssessmentCommandService.CreateSessionCommand createCommand(Long durationSeconds, String key) {
        return new AssessmentCommandService.CreateSessionCommand(
                AssessmentSessionType.DAILY_STREAM,
                List.of(new AssessmentCommandService.ContentReference("question-001", 101L, 501L)),
                durationSeconds, key, "req-" + key, "trace-" + key);
    }

    private static AssessmentCommandService.SubmitAnswerCommand answerCommand(
            String sessionId, long exerciseId, String clientSubmissionId, int revision,
            String idempotencyKey, String requestId, String traceId, String selectedOption) {
        return new AssessmentCommandService.SubmitAnswerCommand(sessionId, exerciseId, clientSubmissionId, revision,
                Map.of("selectedOptionKeys", List.of(selectedOption)), idempotencyKey, requestId, traceId);
    }

    private static ContentSnapshot snapshot(ContentSnapshotPort.ContentSnapshotRequest request) {
        return new ContentSnapshot(request.contentCode(), request.contentVersionId(), request.questionId(), 7001L,
                QuestionType.CHOICE,
                Map.of("stem", "Choose the correct option", "options", List.of(
                        Map.of("key", "A", "label", "Wrong"), Map.of("key", "B", "label", "Right"))),
                Map.of("correctOption", "B", "errorCategory", "GRAMMAR_TRAP"),
                "ASM-RULE-1", 1, true);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    private static void assertLearnerPayloadDoesNotLeakAnswers(Map<String, Object> payload) {
        String serialized = payload.toString();
        require(!serialized.contains("correctOption"), "answer rule must not be returned to the client");
        require(!serialized.contains("answerRules"), "answer rules must not be returned to the client");
        require(!serialized.contains("selectedOptionKeys"), "raw answer must not be returned to the client");
    }

    private static void assertOutboxDoesNotLeakAnswers(InMemoryAssessmentOutbox outbox) {
        for (var event : outbox.events()) {
            String serialized = event.payload().toString();
            require(!serialized.contains("correctOption"), "outbox must not contain answer rules");
            require(!serialized.contains("answerRules"), "outbox must not contain answer rules");
            require(!serialized.contains("selectedOptionKeys"), "outbox must not contain raw answers");
        }
    }

    private static void expectCode(String expected, Runnable action) {
        try {
            action.run();
            throw new AssertionError("expected " + expected);
        } catch (AssessmentDomainException exception) {
            requireEquals(expected, exception.code(), "unexpected domain error");
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void requireEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new AssertionError(message + ": expected=" + expected + ", actual=" + actual);
        }
    }

    private static final class MutableClock extends Clock {
        private Instant current;

        private MutableClock(Instant current) { this.current = current; }

        @Override
        public ZoneId getZone() { return ZoneOffset.UTC; }

        @Override
        public Clock withZone(ZoneId zone) { return this; }

        @Override
        public Instant instant() { return current; }

        private void advance(Duration duration) { current = current.plus(duration); }
    }
}
