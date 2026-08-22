package com.englishflow.assessment.application;

import com.englishflow.assessment.domain.AssessmentAttempt;
import com.englishflow.assessment.domain.AssessmentDomainException;
import com.englishflow.assessment.domain.AssessmentMistake;
import com.englishflow.assessment.domain.AssessmentPrincipal;
import com.englishflow.assessment.domain.AssessmentReport;
import com.englishflow.assessment.domain.AssessmentSession;
import com.englishflow.assessment.domain.AssessmentSessionStatus;
import com.englishflow.assessment.domain.AssessmentSessionType;
import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.domain.RuleScoringEngine;
import com.englishflow.assessment.domain.SafePayloads;
import com.englishflow.assessment.domain.ScoringResult;
import com.englishflow.assessment.domain.ScoringStatus;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import com.englishflow.assessment.port.ContentSnapshotPort;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * Application boundary for assessment commands and self-scoped reads.
 *
 * <p>This is intentionally transport-neutral. A future Spring controller can map the existing
 * B1/B2 OpenAPI operations to these commands without moving authority into a BFF or client.</p>
 */
public final class AssessmentCommandService {
    private static final String EVENT_SCHEMA = "assessment.event.v1";
    private static final String RULE_VERSION = "ASM-RULE-1";
    private static final String CALCULATION_VERSION = "ASM-REPORT-1";

    private final ContentSnapshotPort contentSnapshotPort;
    private final AssessmentOutboxPort outbox;
    private final RuleScoringEngine scoringEngine;
    private final Clock clock;
    private final Map<String, AssessmentSession> sessions = new LinkedHashMap<>();
    private final Map<String, AssessmentReport> reports = new LinkedHashMap<>();
    private final Map<String, AssessmentMistake> mistakes = new LinkedHashMap<>();
    private final Map<String, IdempotencyRecord> idempotency = new LinkedHashMap<>();
    private final AtomicLong reportIds = new AtomicLong(320_000);
    private final AtomicLong mistakeIds = new AtomicLong(420_000);

    public AssessmentCommandService(ContentSnapshotPort contentSnapshotPort,
                                    AssessmentOutboxPort outbox,
                                    Clock clock) {
        this.contentSnapshotPort = Objects.requireNonNull(contentSnapshotPort, "contentSnapshotPort is required");
        this.outbox = Objects.requireNonNull(outbox, "outbox is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        this.scoringEngine = new RuleScoringEngine();
    }

    public Map<String, Object> createSession(AssessmentPrincipal principal, CreateSessionCommand command) {
        principal.requireAuthenticated();
        Objects.requireNonNull(command, "command is required");
        return idempotent(principal, "session.create", command.idempotencyKey(), command.fingerprint(), command.requestId(), () -> {
            List<ContentSnapshot> snapshots = new ArrayList<>();
            for (ContentReference reference : command.contentReferences()) {
                snapshots.add(contentSnapshotPort.fetch(new ContentSnapshotPort.ContentSnapshotRequest(
                        principal, reference.contentCode(), reference.contentVersionId(), reference.questionId())));
            }
            AssessmentSession session = AssessmentSession.create(principal, command.sessionType(), snapshots,
                    now(), command.durationSeconds() == null ? null : Duration.ofSeconds(command.durationSeconds()));
            sessions.put(session.sessionId(), session);
            emit(principal, command.requestId(), command.traceId(), "assessment.started.v1", "assessment_session",
                    session.sessionId(), "assessment.started:" + session.sessionId(), Map.of(
                            "sessionId", session.sessionId(),
                            "sessionType", session.type().name(),
                            "contentVersionIds", snapshots.stream().map(ContentSnapshot::contentVersionId).toList(),
                            "questionCount", snapshots.size(),
                            "startedAt", session.createdAt().toString()));
            return sessionView(principal, session);
        });
    }

    public Map<String, Object> startSession(AssessmentPrincipal principal, String sessionId, String key,
                                            String requestId, String traceId) {
        AssessmentSession session = owned(principal, sessionId);
        return idempotent(principal, "session.start:" + sessionId, key, Map.of("sessionId", sessionId), requestId, () -> {
            session.start(now());
            return sessionView(principal, session);
        });
    }

    public Map<String, Object> interruptSession(AssessmentPrincipal principal, String sessionId,
                                                String requestId, String traceId) {
        AssessmentSession session = owned(principal, sessionId);
        session.interrupt(now());
        return sessionView(principal, session);
    }

    public Map<String, Object> resumeSession(AssessmentPrincipal principal, String sessionId,
                                             String requestId, String traceId) {
        AssessmentSession session = owned(principal, sessionId);
        autoSubmitIfDue(principal, session, requestId, traceId);
        session.resume(now());
        return sessionView(principal, session);
    }

    public Map<String, Object> getSession(AssessmentPrincipal principal, String sessionId) {
        AssessmentSession session = owned(principal, sessionId);
        autoSubmitIfDue(principal, session, "req-read-" + sessionId, "trace-read-" + sessionId);
        return sessionView(principal, session);
    }

    public Map<String, Object> submitAnswer(AssessmentPrincipal principal, SubmitAnswerCommand command) {
        principal.requireAuthenticated();
        Objects.requireNonNull(command, "command is required");
        AssessmentSession session = owned(principal, command.sessionId());
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("sessionId", command.sessionId());
        requestBody.put("exerciseId", command.exerciseId());
        requestBody.put("clientSubmissionId", command.clientSubmissionId());
        requestBody.put("revision", command.revision());
        requestBody.put("answer", command.answer());
        return idempotent(principal, "answer.submit:" + command.sessionId(), command.idempotencyKey(), requestBody,
                command.requestId(), () -> {
                    autoSubmitIfDue(principal, session, command.requestId(), command.traceId());
                    if (session.status() == AssessmentSessionStatus.AUTO_SUBMITTED || session.status() == AssessmentSessionStatus.COMPLETED) {
                        return lateResult(command, session);
                    }
                    if (SafePayloads.containsSensitive(command.answer())) {
                        throw AssessmentDomainException.invalid("ASM_ANSWER_SCHEMA_INVALID", "client cannot submit score or answer-rule fields");
                    }
                    if (command.answer().containsKey("exerciseId")) {
                        throw AssessmentDomainException.invalid("ASM_ANSWER_SCHEMA_INVALID", "exerciseId belongs to the request envelope");
                    }
                    Map<String, Object> storedAnswer = SafePayloads.copyMap(command.answer());
                    storedAnswer.put("exerciseId", command.exerciseId());
                    AssessmentAttempt attempt = session.acceptAttempt(command.clientSubmissionId(), command.revision(), storedAnswer, now());
                    if (attempt.scoringResult() == null) {
                        ScoringResult result = session.type().examLike()
                                ? acceptedForExam(attempt, session.exercise(command.exerciseId()).snapshot())
                                : scoringEngine.score(session.exercise(command.exerciseId()).snapshot(), storedAnswer);
                        attempt.setScoringResult(result);
                        if (result.correct() != null && !result.correct()) recordMistake(principal, session, command.exerciseId(), result,
                                command.requestId(), command.traceId());
                    }
                    ScoringResult result = attempt.scoringResult();
                    emit(principal, command.requestId(), command.traceId(), "attempt.saved.v1", "assessment_attempt",
                            String.valueOf(attempt.submissionId()), "attempt.saved:" + attempt.submissionId(), Map.of(
                                    "submissionId", attempt.submissionId(),
                                    "sessionId", session.sessionId(),
                                    "exerciseId", attempt.exerciseId(),
                                    "revision", attempt.revision(),
                                    "scoringStatus", result.status().name(),
                                    "answerHash", attempt.answerHash(),
                                    "submittedAt", attempt.submittedAt().toString()));
                    return answerView(command.requestId(), command.traceId(), session, attempt, result);
                });
    }

    public Map<String, Object> saveCheckpoint(AssessmentPrincipal principal, CheckpointCommand command) {
        principal.requireAuthenticated();
        Objects.requireNonNull(command, "command is required");
        AssessmentSession session = owned(principal, command.sessionId());
        Map<String, Object> requestBody = Map.of("sessionId", command.sessionId(), "sequence", command.sequence(),
                "currentExerciseId", command.currentExerciseId() == null ? 0 : command.currentExerciseId(),
                "clientStateHash", command.clientStateHash(), "monotonicElapsedMs", command.monotonicElapsedMs());
        return idempotent(principal, "checkpoint.save:" + command.sessionId(), command.idempotencyKey(), requestBody,
                command.requestId(), () -> {
                    autoSubmitIfDue(principal, session, command.requestId(), command.traceId());
                    if (session.status().terminal()) throw AssessmentDomainException.conflict("ASM_SESSION_STATE_CONFLICT", "session is closed");
                    com.englishflow.assessment.domain.AssessmentCheckpoint checkpoint = session.saveCheckpoint(
                            new com.englishflow.assessment.domain.AssessmentCheckpoint(command.sequence(), command.currentExerciseId(),
                                    command.clientStateHash(), command.monotonicElapsedMs(), now()));
                    return Map.of("requestId", command.requestId(), "traceId", command.traceId(), "accepted", true,
                            "checkpointSeq", checkpoint.sequence(), "serverNow", now().toString(), "status", session.status().name());
                });
    }

    public Map<String, Object> completeSession(AssessmentPrincipal principal, String sessionId, String key,
                                               String requestId, String traceId) {
        AssessmentSession session = owned(principal, sessionId);
        return idempotent(principal, "session.complete:" + sessionId, key, Map.of("sessionId", sessionId), requestId, () -> {
            autoSubmitIfDue(principal, session, requestId, traceId);
            if (session.status() == AssessmentSessionStatus.AUTO_SUBMITTED || session.status() == AssessmentSessionStatus.COMPLETED) return reportView(principal, session);
            session.beginSubmit(now());
            return finalizeSession(principal, session, false, requestId, traceId);
        });
    }

    public Map<String, Object> getReport(AssessmentPrincipal principal, String sessionId) {
        AssessmentSession session = owned(principal, sessionId);
        AssessmentReport report = reports.get(sessionId);
        if (report == null) throw AssessmentDomainException.retryable("ASM_REPORT_PROCESSING", "report is not ready");
        return Map.of("requestId", "report-read-" + sessionId, "data", report.learnerView());
    }

    public List<Map<String, Object>> listMistakes(AssessmentPrincipal principal) {
        principal.requireAuthenticated();
        List<Map<String, Object>> result = new ArrayList<>();
        for (AssessmentMistake mistake : mistakes.values()) {
            if (mistake.tenantId().equals(principal.tenantId()) && mistake.ownerSubjectId().equals(principal.subjectId())) {
                result.add(mistake.learnerView());
            }
        }
        return List.copyOf(result);
    }

    private void autoSubmitIfDue(AssessmentPrincipal principal, AssessmentSession session, String requestId, String traceId) {
        Instant current = now();
        if (session.beginAutoSubmit(current)) finalizeSession(principal, session, true, requestId, traceId);
    }

    private Map<String, Object> finalizeSession(AssessmentPrincipal principal, AssessmentSession session,
                                                boolean autoSubmitted, String requestId, String traceId) {
        double score = 0;
        double max = 0;
        int completed = 0;
        List<Map<String, Object>> evidence = new ArrayList<>();
        for (AssessmentSession.Exercise exercise : session.exercises()) {
            AssessmentAttempt attempt = session.latestAttempt(exercise.exerciseId());
            ScoringResult result;
            if (attempt == null) {
                result = ScoringResult.notAttempted(exercise.snapshot().maxScore(), exercise.snapshot().scoringVersion());
            } else {
                if (attempt.scoringResult() == null || attempt.scoringResult().status() == ScoringStatus.ACCEPTED) {
                    result = scoringEngine.score(exercise.snapshot(), attempt.answerForScoring());
                    attempt.setScoringResult(result);
                    if (result.correct() != null && !result.correct()) recordMistake(principal, session, exercise.exerciseId(), result, requestId, traceId);
                } else result = attempt.scoringResult();
            }
            max += result.maxScore();
            score += result.earnedScore();
            if (attempt != null && result.status() != ScoringStatus.NOT_ATTEMPTED) completed++;
            evidence.add(Map.of("exerciseId", exercise.exerciseId(), "questionId", exercise.snapshot().questionId(),
                    "itemId", exercise.snapshot().itemId(), "status", result.status().name(),
                    "score", result.earnedScore(), "maxScore", result.maxScore(),
                    "errorCauseCandidates", result.errorCauseCandidates()));
        }
        AssessmentReport report = new AssessmentReport(reportIds.incrementAndGet(), session.sessionId(), principal.tenantId(),
                principal.subjectId(), session.type().examLike() ? "EXAM_DIAGNOSTIC" : "DAILY", "READY", score, max,
                completed, session.exercises().size(), CALCULATION_VERSION, RULE_VERSION, now(),
                Map.of("accuracy", max == 0 ? 0 : score / max * 100, "autoSubmitted", autoSubmitted), evidence,
                mistakesFor(principal, session));
        reports.put(session.sessionId(), report);
        session.finishSubmit(autoSubmitted, now());
        emit(principal, requestId, traceId, "assessment.submitted.v1", "assessment_session", session.sessionId(),
                "assessment.submitted:" + session.sessionId(), Map.of("sessionId", session.sessionId(),
                        "status", session.status().name(), "completedCount", completed, "totalCount", session.exercises().size(),
                        "score", score, "maxScore", max, "submittedAt", now().toString()));
        emit(principal, requestId, traceId, "report.generated.v1", "learning_report", String.valueOf(report.reportId()),
                "report.generated:" + report.reportId(), Map.of("reportId", report.reportId(), "sessionId", session.sessionId(),
                        "reportType", report.reportType(), "calculationVersion", report.calculationVersion(),
                        "status", report.status(), "generatedAt", report.generatedAt().toString()));
        return Map.of("requestId", requestId, "traceId", traceId, "data", report.learnerView());
    }

    private void recordMistake(AssessmentPrincipal principal, AssessmentSession session, long exerciseId,
                               ScoringResult result, String requestId, String traceId) {
        AssessmentSession.Exercise exercise = session.exercise(exerciseId);
        String category = result.errorCauseCandidates().isEmpty() ? "OTHER" : result.errorCauseCandidates().get(0);
        String key = principal.tenantId() + ":" + principal.subjectId() + ":" + exercise.snapshot().itemId() + ":" + category;
        AssessmentMistake mistake = mistakes.get(key);
        if (mistake == null) {
            mistake = new AssessmentMistake(mistakeIds.incrementAndGet(), principal, exercise.snapshot().itemId(),
                    exercise.snapshot().questionId(), category, result.ruleVersion(), result.normalizedAnswerHash(), now());
            mistakes.put(key, mistake);
        } else mistake.mergeWrong(now(), category);
        emit(principal, requestId, traceId, "mastery.verification_due.v1", "assessment_mistake",
                String.valueOf(mistake.mistakeId()), "mistake.updated:" + mistake.mistakeId() + ":" + mistake.wrongCount(),
                Map.of("mistakeId", mistake.mistakeId(), "itemId", mistake.itemId(), "questionId", mistake.questionId(),
                        "mistakeStatus", mistake.mistakeStatus().name(), "masteryStatus", mistake.masteryStatus().name(),
                        "errorCategory", mistake.errorCategory(), "ruleVersion", mistake.ruleVersion(),
                        "changedAt", now().toString()));
    }

    private List<Map<String, Object>> mistakesFor(AssessmentPrincipal principal, AssessmentSession session) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (AssessmentMistake mistake : mistakes.values()) {
            if (mistake.tenantId().equals(principal.tenantId()) && mistake.ownerSubjectId().equals(principal.subjectId())) {
                for (AssessmentSession.Exercise exercise : session.exercises()) {
                    if (exercise.snapshot().itemId() == mistake.itemId()) result.add(mistake.learnerView());
                }
            }
        }
        return List.copyOf(result);
    }

    private Map<String, Object> answerView(String requestId, String traceId, AssessmentSession session,
                                            AssessmentAttempt attempt, ScoringResult result) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("requestId", requestId);
        view.put("traceId", traceId);
        view.put("sessionId", session.sessionId());
        view.put("submissionId", attempt.submissionId());
        view.put("exerciseId", attempt.exerciseId());
        view.put("accepted", true);
        view.put("revision", attempt.revision());
        view.put("scoringStatus", result.status().name());
        view.put("isCorrect", session.type().examLike() ? null : result.correct());
        view.put("score", session.type().examLike() ? null : result.earnedScore());
        view.put("maxScore", session.type().examLike() ? null : result.maxScore());
        view.put("errorCauseCandidates", session.type().examLike() ? List.of() : result.errorCauseCandidates());
        view.put("masteryEffect", session.type().examLike() ? null : Map.of("ruleVersion", result.ruleVersion()));
        view.put("serverNow", now().toString());
        return immutableMap(view);
    }

    private Map<String, Object> lateResult(SubmitAnswerCommand command, AssessmentSession session) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestId", command.requestId());
        result.put("traceId", command.traceId());
        result.put("sessionId", session.sessionId());
        result.put("exerciseId", command.exerciseId());
        result.put("accepted", false);
        result.put("scoringStatus", ScoringStatus.LATE.name());
        result.put("isCorrect", null);
        result.put("score", null);
        result.put("maxScore", null);
        result.put("errorCauseCandidates", List.of());
        return immutableMap(result);
    }

    private Map<String, Object> reportView(AssessmentPrincipal principal, AssessmentSession session) {
        AssessmentReport report = reports.get(session.sessionId());
        if (report == null) throw AssessmentDomainException.retryable("ASM_REPORT_PROCESSING", "report is not ready");
        return Map.of("requestId", "report-replay-" + session.sessionId(), "data", report.learnerView());
    }

    private ScoringResult acceptedForExam(AssessmentAttempt attempt, ContentSnapshot snapshot) {
        return new ScoringResult(0, snapshot.maxScore(), null, ScoringStatus.ACCEPTED, attempt.answerHash(), List.of(),
                snapshot.scoringVersion(), Map.of());
    }

    private Map<String, Object> sessionView(AssessmentPrincipal principal, AssessmentSession session) {
        List<Map<String, Object>> exerciseViews = new ArrayList<>();
        for (AssessmentSession.Exercise exercise : session.exercises()) {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("sessionId", session.sessionId());
            view.put("exerciseId", exercise.exerciseId());
            view.put("questionId", exercise.snapshot().questionId());
            view.put("itemId", exercise.snapshot().itemId());
            view.put("contentVersionId", exercise.snapshot().contentVersionId());
            view.put("questionType", exercise.snapshot().questionType().name());
            view.put("position", exercise.position());
            view.put("sourceBucket", exercise.sourceBucket());
            view.put("verificationStage", exercise.verificationStage());
            view.put("prompt", exercise.snapshot().learnerView());
            view.put("feedbackPolicy", session.type().examLike() ? "AFTER_SUBMIT" : "IMMEDIATE");
            exerciseViews.add(immutableMap(view));
        }
        List<Map<String, Object>> answerSheet = new ArrayList<>();
        for (AssessmentSession.Exercise exercise : session.exercises()) {
            AssessmentAttempt attempt = session.latestAttempt(exercise.exerciseId());
            answerSheet.add(Map.of("exerciseId", exercise.exerciseId(), "position", exercise.position(),
                    "status", attempt == null ? "UNANSWERED" : "ANSWERED", "revision", attempt == null ? 0 : attempt.revision()));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("sessionId", session.sessionId());
        data.put("sessionType", session.type().name());
        data.put("status", session.status().name());
        data.put("serverNow", now().toString());
        data.put("deadlineAt", session.deadlineAt() == null ? null : session.deadlineAt().toString());
        data.put("remainingSec", session.remainingSeconds(now()));
        data.put("lastCheckpointSeq", session.checkpoint() == null ? 0 : session.checkpoint().sequence());
        data.put("exercises", exerciseViews);
        data.put("answerSheet", answerSheet);
        return Map.of("requestId", "session-read-" + session.sessionId(), "data", immutableMap(data));
    }

    private AssessmentSession owned(AssessmentPrincipal principal, String sessionId) {
        principal.requireAuthenticated();
        AssessmentSession session = sessions.get(sessionId);
        if (session == null) throw AssessmentDomainException.notFound("session does not exist");
        if (!session.owner().tenantId().equals(principal.tenantId()) || !session.owner().subjectId().equals(principal.subjectId())) {
            throw AssessmentDomainException.forbidden("session is outside the principal owner scope");
        }
        return session;
    }

    private void emit(AssessmentPrincipal principal, String requestId, String traceId, String eventName,
                      String aggregateType, String aggregateId, String dedupeKey, Map<String, Object> payload) {
        outbox.append(new AssessmentOutboxPort.AssessmentOutboxEvent(UUID.randomUUID(), eventName, aggregateType, aggregateId,
                principal.tenantId(), principal.subjectId(), requestId, traceId, EVENT_SCHEMA, 1, dedupeKey, payload, now()));
    }

    private Map<String, Object> idempotent(AssessmentPrincipal principal, String operation, String key,
                                           Object body, String requestId, Supplier<Map<String, Object>> action) {
        if (key == null || key.isBlank() || key.length() < 8 || key.length() > 128) {
            throw AssessmentDomainException.invalid("ASM_IDEMPOTENCY_REQUIRED", "Idempotency-Key is required");
        }
        String identity = principal.tenantId() + ":" + principal.subjectId() + ":" + operation + ":" + key;
        String digest = SafePayloads.digest(body);
        synchronized (idempotency) {
            IdempotencyRecord existing = idempotency.get(identity);
            if (existing != null) {
                if (!existing.requestDigest().equals(digest)) throw AssessmentDomainException.conflict("ASM_IDEMPOTENCY_KEY_REUSE", "same key was reused with a different request");
                return existing.response();
            }
            Map<String, Object> response = freezeMap(action.get());
            idempotency.put(identity, new IdempotencyRecord(digest, response));
            return response;
        }
    }

    private Instant now() { return Instant.now(clock); }

    private static Map<String, Object> freezeMap(Map<String, Object> source) {
        return immutableMap(source);
    }

    private static Map<String, Object> immutableMap(Map<String, Object> source) {
        return Collections.unmodifiableMap(new LinkedHashMap<>(SafePayloads.copyMap(source)));
    }

    private record IdempotencyRecord(String requestDigest, Map<String, Object> response) { }

    public record ContentReference(String contentCode, long contentVersionId, long questionId) {
        public ContentReference {
            if (contentCode == null || contentCode.isBlank() || contentVersionId < 1 || questionId < 1) {
                throw AssessmentDomainException.invalid("ASM_CONTENT_REFERENCE_INVALID", "content reference is invalid");
            }
        }
    }

    public record CreateSessionCommand(AssessmentSessionType sessionType, List<ContentReference> contentReferences,
                                       Long durationSeconds, String idempotencyKey, String requestId, String traceId) {
        public CreateSessionCommand {
            sessionType = Objects.requireNonNull(sessionType, "sessionType is required");
            contentReferences = List.copyOf(contentReferences == null ? List.of() : contentReferences);
            if (contentReferences.isEmpty()) throw AssessmentDomainException.invalid("ASM_SESSION_EMPTY", "contentReferences are required");
            if (durationSeconds != null && (durationSeconds < 1 || durationSeconds > 7 * 24 * 60 * 60)) throw AssessmentDomainException.invalid("ASM_DURATION_INVALID", "durationSeconds is invalid");
            idempotencyKey = requiredText(idempotencyKey, "idempotencyKey");
            requestId = correlation(requestId, "req-");
            traceId = correlation(traceId, "trace-");
        }
        public Map<String, Object> fingerprint() {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("sessionType", sessionType.name());
            value.put("contentReferences", contentReferences);
            value.put("durationSeconds", durationSeconds);
            return value;
        }
    }

    public record SubmitAnswerCommand(String sessionId, long exerciseId, String clientSubmissionId, int revision,
                                      Map<String, Object> answer, String idempotencyKey, String requestId, String traceId) {
        public SubmitAnswerCommand {
            if (sessionId == null || sessionId.isBlank() || exerciseId < 1 || revision < 1) throw AssessmentDomainException.invalid("ASM_ANSWER_SCHEMA_INVALID", "answer envelope is invalid");
            clientSubmissionId = requiredText(clientSubmissionId, "clientSubmissionId");
            answer = SafePayloads.freeze(answer == null ? Map.of() : answer);
            idempotencyKey = requiredText(idempotencyKey == null || idempotencyKey.isBlank() ? clientSubmissionId : idempotencyKey, "idempotencyKey");
            requestId = correlation(requestId, "req-");
            traceId = correlation(traceId, "trace-");
        }
    }

    public record CheckpointCommand(String sessionId, long sequence, Long currentExerciseId, String clientStateHash,
                                    long monotonicElapsedMs, String idempotencyKey, String requestId, String traceId) {
        public CheckpointCommand {
            if (sessionId == null || sessionId.isBlank() || sequence < 1 || monotonicElapsedMs < 0) throw AssessmentDomainException.invalid("ASM_CHECKPOINT_INVALID", "checkpoint envelope is invalid");
            if (currentExerciseId != null && currentExerciseId < 1) throw AssessmentDomainException.invalid("ASM_CHECKPOINT_INVALID", "currentExerciseId is invalid");
            if (clientStateHash == null || !clientStateHash.matches("[A-Fa-f0-9]{64,128}")) throw AssessmentDomainException.invalid("ASM_CHECKPOINT_INVALID", "clientStateHash must be a digest");
            idempotencyKey = requiredText(idempotencyKey, "idempotencyKey");
            requestId = correlation(requestId, "req-");
            traceId = correlation(traceId, "trace-");
        }
    }

    private static String requiredText(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 128) throw AssessmentDomainException.invalid("ASM_REQUEST_INVALID", field + " is required");
        return value;
    }

    private static String correlation(String value, String prefix) {
        return value == null || value.isBlank() ? prefix + UUID.randomUUID() : requiredText(value, "correlation");
    }
}
