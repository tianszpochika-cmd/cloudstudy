package com.englishflow.assessment.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/** Assessment aggregate with frozen content snapshots and owner-scoped state transitions. */
public final class AssessmentSession {
    private static final AtomicLong EXERCISE_IDS = new AtomicLong(120_000);
    private static final AtomicLong SUBMISSION_IDS = new AtomicLong(220_000);

    private final String sessionId;
    private final AssessmentPrincipal owner;
    private final AssessmentSessionType type;
    private final Instant createdAt;
    private final Instant deadlineAt;
    private final Map<Long, Exercise> exercises = new LinkedHashMap<>();
    private final Map<Long, AssessmentAttempt> latestAttempts = new LinkedHashMap<>();
    private final Map<String, AssessmentAttempt> submissionsByClientId = new LinkedHashMap<>();
    private AssessmentSessionStatus status = AssessmentSessionStatus.CREATED;
    private Instant startedAt;
    private Instant closedAt;
    private AssessmentCheckpoint checkpoint;

    private AssessmentSession(String sessionId, AssessmentPrincipal owner, AssessmentSessionType type,
                               Instant createdAt, Instant deadlineAt) {
        this.sessionId = sessionId;
        this.owner = owner;
        this.type = type;
        this.createdAt = createdAt;
        this.deadlineAt = deadlineAt;
    }

    public static AssessmentSession create(AssessmentPrincipal owner, AssessmentSessionType type,
                                           List<ContentSnapshot> snapshots, Instant now, Duration duration) {
        Objects.requireNonNull(owner, "owner is required").requireAuthenticated();
        Objects.requireNonNull(type, "type is required");
        Objects.requireNonNull(now, "now is required");
        if (snapshots == null || snapshots.isEmpty()) throw AssessmentDomainException.invalid("ASM_SESSION_EMPTY", "session requires at least one question");
        if (duration != null && (duration.isNegative() || duration.isZero() || duration.compareTo(Duration.ofDays(7)) > 0)) {
            throw AssessmentDomainException.invalid("ASM_DURATION_INVALID", "duration is outside the allowed range");
        }
        AssessmentSession session = new AssessmentSession(UUID.randomUUID().toString(), owner, type, now,
                duration == null ? null : now.plus(duration));
        int position = 1;
        for (ContentSnapshot snapshot : snapshots) {
            long exerciseId = EXERCISE_IDS.incrementAndGet();
            session.exercises.put(exerciseId, new Exercise(exerciseId, snapshot, position++, sourceBucket(type), null));
        }
        return session;
    }

    private static String sourceBucket(AssessmentSessionType type) {
        return switch (type) {
            case DAILY_STREAM -> "REVIEW";
            case QUICK_PRACTICE -> "NEW";
            case CHECKPOINT -> "MISTAKE";
            case MOCK_EXAM -> "EXAM";
        };
    }

    public synchronized void start(Instant now) {
        Objects.requireNonNull(now, "now is required");
        if (status == AssessmentSessionStatus.CREATED) {
            if (deadlineAt != null && !now.isBefore(deadlineAt)) {
                status = AssessmentSessionStatus.EXPIRED;
                closedAt = now;
                throw AssessmentDomainException.conflict("ASM_SESSION_EXPIRED", "session start window has expired");
            }
            status = AssessmentSessionStatus.IN_PROGRESS;
            startedAt = now;
            return;
        }
        if (status == AssessmentSessionStatus.IN_PROGRESS) return;
        throw AssessmentDomainException.conflict("ASM_SESSION_STATE_CONFLICT", "session cannot start from " + status);
    }

    public synchronized void interrupt(Instant now) {
        if (status == AssessmentSessionStatus.IN_PROGRESS) status = AssessmentSessionStatus.INTERRUPTED;
    }

    public synchronized void resume(Instant now) {
        Objects.requireNonNull(now, "now is required");
        if (status != AssessmentSessionStatus.INTERRUPTED) {
            if (status == AssessmentSessionStatus.IN_PROGRESS) return;
            throw AssessmentDomainException.conflict("ASM_SESSION_STATE_CONFLICT", "session cannot resume from " + status);
        }
        if (deadlineAt != null && !now.isBefore(deadlineAt)) throw AssessmentDomainException.conflict("ASM_SESSION_EXPIRED", "session deadline has passed");
        status = AssessmentSessionStatus.IN_PROGRESS;
    }

    public synchronized AssessmentAttempt acceptAttempt(String clientSubmissionId, int revision,
                                                          Map<String, Object> answer, Instant now) {
        ensureWritable(now);
        long exerciseId = requiredExerciseFromAnswer(answer);
        Exercise exercise = exercises.get(exerciseId);
        if (exercise == null) throw AssessmentDomainException.notFound("exercise does not belong to session");
        AssessmentAttempt existing = submissionsByClientId.get(clientSubmissionId);
        if (existing != null) {
            String submittedHash = SafePayloads.digest(answer == null ? Map.of() : answer);
            if (existing.revision() != revision || !existing.answerHash().equals(submittedHash)) {
                throw AssessmentDomainException.conflict("ASM_CLIENT_SUBMISSION_REUSE", "clientSubmissionId was reused with a different answer");
            }
            return existing;
        }
        AssessmentAttempt previous = latestAttempts.get(exerciseId);
        if (previous != null && revision <= previous.revision()) throw AssessmentDomainException.conflict("ASM_REVISION_CONFLICT", "attempt revision must increase");
        AssessmentAttempt attempt = new AssessmentAttempt(SUBMISSION_IDS.incrementAndGet(), exerciseId, clientSubmissionId, revision, answer, now);
        latestAttempts.put(exerciseId, attempt);
        submissionsByClientId.put(clientSubmissionId, attempt);
        return attempt;
    }

    public synchronized AssessmentAttempt latestAttempt(long exerciseId) { return latestAttempts.get(exerciseId); }

    public synchronized AssessmentCheckpoint saveCheckpoint(AssessmentCheckpoint next) {
        Objects.requireNonNull(next, "checkpoint is required");
        if (checkpoint != null) {
            if (next.sequence() < checkpoint.sequence()) throw AssessmentDomainException.conflict("ASM_CHECKPOINT_CONFLICT", "checkpoint sequence cannot move backwards");
            if (next.sequence() == checkpoint.sequence()) {
                if (!next.clientStateHash().equals(checkpoint.clientStateHash())) throw AssessmentDomainException.conflict("ASM_CHECKPOINT_CONFLICT", "same sequence has a different state hash");
                return checkpoint;
            }
        }
        checkpoint = next;
        return checkpoint;
    }

    public synchronized boolean beginAutoSubmit(Instant now) {
        if (status.terminal() || deadlineAt == null || now.isBefore(deadlineAt)) return false;
        if (status == AssessmentSessionStatus.IN_PROGRESS || status == AssessmentSessionStatus.INTERRUPTED || status == AssessmentSessionStatus.CREATED) {
            status = AssessmentSessionStatus.SUBMITTING;
            return true;
        }
        return status == AssessmentSessionStatus.SUBMITTING;
    }

    public synchronized void beginSubmit(Instant now) {
        Objects.requireNonNull(now, "now is required");
        if (status == AssessmentSessionStatus.COMPLETED || status == AssessmentSessionStatus.AUTO_SUBMITTED) return;
        if (status == AssessmentSessionStatus.CANCELLED || status == AssessmentSessionStatus.EXPIRED) throw AssessmentDomainException.conflict("ASM_SESSION_STATE_CONFLICT", "session cannot be submitted from " + status);
        status = AssessmentSessionStatus.SUBMITTING;
    }

    public synchronized void finishSubmit(boolean autoSubmitted, Instant now) {
        if (status != AssessmentSessionStatus.SUBMITTING && !status.terminal()) throw AssessmentDomainException.conflict("ASM_SESSION_STATE_CONFLICT", "session is not submitting");
        if (!status.terminal()) status = autoSubmitted ? AssessmentSessionStatus.AUTO_SUBMITTED : AssessmentSessionStatus.COMPLETED;
        closedAt = now;
    }

    private void ensureWritable(Instant now) {
        if (status != AssessmentSessionStatus.IN_PROGRESS) throw AssessmentDomainException.conflict("ASM_SESSION_STATE_CONFLICT", "session is not accepting answers: " + status);
        if (deadlineAt != null && !now.isBefore(deadlineAt)) throw AssessmentDomainException.conflict("ASM_SESSION_DEADLINE_PASSED", "session deadline has passed");
    }

    private static long requiredExerciseFromAnswer(Map<String, Object> answer) {
        Object value = answer == null ? null : answer.get("exerciseId");
        if (!(value instanceof Number number) || number.longValue() < 1) throw AssessmentDomainException.invalid("ASM_ANSWER_SCHEMA_INVALID", "exerciseId is required");
        return number.longValue();
    }

    public String sessionId() { return sessionId; }
    public AssessmentPrincipal owner() { return owner; }
    public AssessmentSessionType type() { return type; }
    public Instant createdAt() { return createdAt; }
    public Instant startedAt() { return startedAt; }
    public Instant deadlineAt() { return deadlineAt; }
    public synchronized AssessmentSessionStatus status() { return status; }
    public synchronized Instant closedAt() { return closedAt; }
    public synchronized AssessmentCheckpoint checkpoint() { return checkpoint; }
    public synchronized List<Exercise> exercises() { return List.copyOf(exercises.values()); }
    public synchronized List<AssessmentAttempt> latestAttempts() { return List.copyOf(latestAttempts.values()); }

    public synchronized Exercise exercise(long exerciseId) {
        Exercise exercise = exercises.get(exerciseId);
        if (exercise == null) throw AssessmentDomainException.notFound("exercise does not belong to session");
        return exercise;
    }

    public synchronized long remainingSeconds(Instant now) {
        if (deadlineAt == null) return 0;
        if (!now.isBefore(deadlineAt)) return 0;
        return Math.max(0, Duration.between(now, deadlineAt).toSeconds());
    }

    public record Exercise(long exerciseId, ContentSnapshot snapshot, int position, String sourceBucket, String verificationStage) {
        public Exercise {
            if (exerciseId < 1 || position < 1) throw AssessmentDomainException.invalid("ASM_EXERCISE_INVALID", "exercise identifiers are invalid");
            Objects.requireNonNull(snapshot, "snapshot is required");
            sourceBucket = Objects.requireNonNull(sourceBucket, "sourceBucket is required");
        }
    }
}
