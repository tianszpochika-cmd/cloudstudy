package com.englishflow.assessment.adapter.jdbc;

import com.englishflow.assessment.domain.AssessmentAttempt;
import com.englishflow.assessment.domain.AssessmentCheckpoint;
import com.englishflow.assessment.domain.AssessmentDomainException;
import com.englishflow.assessment.domain.AssessmentMistake;
import com.englishflow.assessment.domain.AssessmentPrincipal;
import com.englishflow.assessment.domain.AssessmentReport;
import com.englishflow.assessment.domain.AssessmentSession;
import com.englishflow.assessment.domain.AssessmentSessionStatus;
import com.englishflow.assessment.domain.AssessmentSessionType;
import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.domain.QuestionType;
import com.englishflow.assessment.domain.ScoringResult;
import com.englishflow.assessment.domain.ScoringStatus;
import com.englishflow.assessment.port.AssessmentStatePort;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * MySQL adapter for assessment-owned facts.  All identifiers are validated before being used as
 * SQL identifiers; values remain prepared statement parameters.  The adapter deliberately stores
 * the frozen content snapshot and the submitted answer, while only the server-created
 * {@link ScoringResult} is written to the score fact.
 */
public final class JdbcAssessmentStatePort implements AssessmentStatePort {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };
    private static final TypeReference<List<Map<String, Object>>> MAP_LIST_TYPE = new TypeReference<>() { };

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final String schema;

    public JdbcAssessmentStatePort(JdbcTemplate jdbc, ObjectMapper objectMapper, String schema) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
        this.schema = identifier(schema, "schema");
    }

    @Override
    public RestoredState load() {
        Map<String, SessionBuilder> builders = new LinkedHashMap<>();
        jdbc.query("SELECT session_id, subject_id, tenant_id, session_type, session_status, created_at, "
                        + "deadline_at, started_at, closed_at FROM " + table("assessment_session"),
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> builders.put(rs.getString("session_id"), new SessionBuilder(rs)));
        jdbc.query("SELECT session_id, exercise_id, position_no, source_bucket, verification_stage, snapshot_json "
                        + "FROM " + table("assessment_session_exercise"), rs -> {
                    SessionBuilder builder = requiredBuilder(builders, rs.getString("session_id"));
                    builder.exercises.add(new AssessmentSession.Exercise(rs.getLong("exercise_id"),
                            readSnapshot(rs.getString("snapshot_json")), rs.getInt("position_no"),
                            rs.getString("source_bucket"), rs.getString("verification_stage")));
                });
        jdbc.query("SELECT af.session_id, af.exercise_id, af.submission_id, af.client_submission_id, af.revision, "
                        + "af.submitted_at, a.answer_json, sf.scoring_status, sf.earned_score, sf.max_score, "
                        + "sf.correct, sf.error_causes_json, sf.rule_version, sf.score_breakdown_json "
                        + "FROM " + table("assessment_attempt_fact") + " af "
                        + "JOIN " + table("assessment_answer") + " a ON a.attempt_id = af.attempt_id "
                        + "LEFT JOIN " + table("assessment_score_fact") + " sf ON sf.attempt_id = af.attempt_id",
                rs -> {
                    SessionBuilder builder = requiredBuilder(builders, rs.getString("session_id"));
                    ScoringResult result = rs.getString("scoring_status") == null ? null : new ScoringResult(
                            rs.getBigDecimal("earned_score").doubleValue(),
                            rs.getBigDecimal("max_score").doubleValue(),
                            nullableBoolean(rs, "correct"),
                            ScoringStatus.valueOf(rs.getString("scoring_status")),
                            com.englishflow.assessment.domain.SafePayloads.digest(readMap(rs.getString("answer_json"))),
                            readStringList(rs.getString("error_causes_json")),
                            rs.getString("rule_version"), readMap(rs.getString("score_breakdown_json")));
                    builder.attempts.add(AssessmentAttempt.restore(rs.getLong("submission_id"),
                            rs.getLong("exercise_id"), rs.getString("client_submission_id"), rs.getInt("revision"),
                            readMap(rs.getString("answer_json")), instant(rs, "submitted_at"), result));
                });
        jdbc.query("SELECT session_id, checkpoint_seq, current_exercise_id, client_state_hash, "
                        + "monotonic_elapsed_ms, saved_at FROM " + table("assessment_checkpoint_fact"), rs -> {
                    SessionBuilder builder = requiredBuilder(builders, rs.getString("session_id"));
                    AssessmentCheckpoint checkpoint = new AssessmentCheckpoint(rs.getLong("checkpoint_seq"),
                            nullableLong(rs, "current_exercise_id"), rs.getString("client_state_hash"),
                            rs.getLong("monotonic_elapsed_ms"), instant(rs, "saved_at"));
                    if (builder.checkpoint == null || checkpoint.sequence() > builder.checkpoint.sequence()) {
                        builder.checkpoint = checkpoint;
                    }
                });

        List<AssessmentSession> sessions = new ArrayList<>();
        for (SessionBuilder builder : builders.values()) {
            builder.exercises.sort(Comparator.comparingInt(AssessmentSession.Exercise::position));
            sessions.add(AssessmentSession.restore(builder.sessionId, builder.owner, builder.type,
                    builder.createdAt, builder.deadlineAt, builder.status, builder.startedAt, builder.closedAt,
                    builder.exercises, builder.attempts, builder.checkpoint));
        }

        List<AssessmentReport> reports = jdbc.query("SELECT report_id, session_id, tenant_id, subject_id, report_type, "
                        + "report_status, score, max_score, completed_count, total_count, calculation_version, "
                        + "score_policy_version, generated_at, metrics_json, evidence_json, mistakes_json FROM "
                        + table("assessment_report"), (rs, rowNum) -> new AssessmentReport(rs.getLong("report_id"),
                        rs.getString("session_id"), rs.getString("tenant_id"), rs.getString("subject_id"),
                        rs.getString("report_type"), rs.getString("report_status"), rs.getBigDecimal("score").doubleValue(),
                        rs.getBigDecimal("max_score").doubleValue(), rs.getInt("completed_count"), rs.getInt("total_count"),
                        rs.getString("calculation_version"), rs.getString("score_policy_version"), instant(rs, "generated_at"),
                        readMap(rs.getString("metrics_json")), readMapList(rs.getString("evidence_json")),
                        readMapList(rs.getString("mistakes_json"))));

        List<AssessmentMistake> mistakes = jdbc.query("SELECT mistake_id, tenant_id, subject_id, item_id, question_id, "
                        + "error_category, rule_version, answer_hash, wrong_count, mistake_status, mastery_status, "
                        + "first_error_at, last_error_at, next_action_at, reason_trace_json FROM "
                        + table("assessment_mistake"), (rs, rowNum) -> AssessmentMistake.restore(rs.getLong("mistake_id"),
                        AssessmentPrincipal.authenticated(rs.getString("subject_id"), rs.getString("tenant_id")),
                        rs.getLong("item_id"), rs.getLong("question_id"), rs.getString("error_category"),
                        rs.getString("rule_version"), rs.getString("answer_hash"), rs.getInt("wrong_count"),
                        AssessmentMistake.MistakeStatus.valueOf(rs.getString("mistake_status")),
                        AssessmentMistake.MasteryStatus.valueOf(rs.getString("mastery_status")),
                        instant(rs, "first_error_at"), instant(rs, "last_error_at"), instant(rs, "next_action_at"),
                        readMapList(rs.getString("reason_trace_json"))));
        return new RestoredState(sessions, reports, mistakes);
    }

    @Override
    public void saveSession(AssessmentSession session) {
        jdbc.update("INSERT INTO " + table("assessment_session")
                        + " (session_id, subject_id, tenant_id, session_type, session_status, created_at, deadline_at, started_at, closed_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE "
                        + "session_status=VALUES(session_status), deadline_at=VALUES(deadline_at), "
                        + "started_at=VALUES(started_at), closed_at=VALUES(closed_at)",
                session.sessionId(), session.owner().subjectId(), session.owner().tenantId(), session.type().name(),
                session.status().name(), timestamp(session.createdAt()), timestamp(session.deadlineAt()),
                timestamp(session.startedAt()), timestamp(session.closedAt()));
        for (AssessmentSession.Exercise exercise : session.exercises()) {
            jdbc.update("INSERT INTO " + table("assessment_session_exercise")
                            + " (session_id, exercise_id, position_no, source_bucket, verification_stage, snapshot_json) "
                            + "VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE "
                            + "position_no=VALUES(position_no), source_bucket=VALUES(source_bucket), "
                            + "verification_stage=VALUES(verification_stage), snapshot_json=VALUES(snapshot_json)",
                    session.sessionId(), exercise.exerciseId(), exercise.position(), exercise.sourceBucket(),
                    exercise.verificationStage(), writeJson(exercise.snapshot()));
        }
    }

    @Override
    public void saveAttempt(AssessmentSession session, AssessmentAttempt attempt) {
        ContentSnapshot snapshot = session.exercise(attempt.exerciseId()).snapshot();
        ScoringResult result = attempt.scoringResult();
        if (result == null) throw AssessmentDomainException.retryable("ASM_PERSISTENCE_INCOMPLETE", "attempt score is not ready");
        String attemptId = UUID.nameUUIDFromBytes((session.sessionId() + ":" + attempt.submissionId())
                .getBytes(StandardCharsets.UTF_8)).toString();
        jdbc.update("INSERT INTO " + table("assessment_attempt_fact")
                        + " (attempt_id, session_id, exercise_id, submission_id, subject_id, tenant_id, client_submission_id, revision, answer_hash, submitted_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE "
                        + "answer_hash=VALUES(answer_hash), submitted_at=VALUES(submitted_at)",
                attemptId, session.sessionId(), attempt.exerciseId(), attempt.submissionId(), session.owner().subjectId(),
                session.owner().tenantId(), attempt.clientSubmissionId(), attempt.revision(), attempt.answerHash(),
                timestamp(attempt.submittedAt()));
        jdbc.update("INSERT INTO " + table("assessment_answer")
                        + " (attempt_id, answer_json, created_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE answer_json=VALUES(answer_json)",
                attemptId, writeJson(attempt.answerForScoring()), timestamp(attempt.submittedAt()));
        jdbc.update("INSERT INTO " + table("assessment_score_fact")
                        + " (attempt_id, scoring_status, earned_score, max_score, correct, error_causes_json, rule_version, score_breakdown_json, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE "
                        + "scoring_status=VALUES(scoring_status), earned_score=VALUES(earned_score), max_score=VALUES(max_score), "
                        + "correct=VALUES(correct), error_causes_json=VALUES(error_causes_json), rule_version=VALUES(rule_version), "
                        + "score_breakdown_json=VALUES(score_breakdown_json), updated_at=VALUES(updated_at)",
                attemptId, result.status().name(), result.earnedScore(), result.maxScore(), result.correct(),
                writeJson(result.errorCauseCandidates()), result.ruleVersion(), writeJson(result.scoreBreakdown()),
                timestamp(attempt.submittedAt()));
        jdbc.update("INSERT INTO " + table("assessment_attempt")
                        + " (attempt_id, subject_id, tenant_id, assessment_version, attempt_status, answer_digest, score_bucket, idempotency_key, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE "
                        + "attempt_status=VALUES(attempt_status), score_bucket=VALUES(score_bucket), updated_at=VALUES(updated_at)",
                attemptId, session.owner().subjectId(), session.owner().tenantId(), snapshot.contentVersionId(),
                result.status().name(), attempt.answerHash(), result.status().name(), attempt.clientSubmissionId(),
                timestamp(attempt.submittedAt()), timestamp(attempt.submittedAt()));
    }

    @Override
    public void saveCheckpoint(String sessionId, AssessmentCheckpoint checkpoint) {
        String checkpointId = UUID.nameUUIDFromBytes((sessionId + ":checkpoint:" + checkpoint.sequence())
                .getBytes(StandardCharsets.UTF_8)).toString();
        jdbc.update("INSERT INTO " + table("assessment_checkpoint_fact")
                        + " (checkpoint_id, session_id, checkpoint_seq, current_exercise_id, client_state_hash, monotonic_elapsed_ms, saved_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE "
                        + "current_exercise_id=VALUES(current_exercise_id), client_state_hash=VALUES(client_state_hash), "
                        + "monotonic_elapsed_ms=VALUES(monotonic_elapsed_ms), saved_at=VALUES(saved_at)",
                checkpointId, sessionId, checkpoint.sequence(), checkpoint.currentExerciseId(), checkpoint.clientStateHash(),
                checkpoint.monotonicElapsedMs(), timestamp(checkpoint.savedAt()));
    }

    @Override
    public void saveReport(AssessmentReport report) {
        jdbc.update("INSERT INTO " + table("assessment_report")
                        + " (report_id, session_id, subject_id, tenant_id, report_type, report_status, score, max_score, completed_count, total_count, calculation_version, score_policy_version, generated_at, metrics_json, evidence_json, mistakes_json) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE "
                        + "report_status=VALUES(report_status), score=VALUES(score), max_score=VALUES(max_score), "
                        + "completed_count=VALUES(completed_count), total_count=VALUES(total_count), metrics_json=VALUES(metrics_json), "
                        + "evidence_json=VALUES(evidence_json), mistakes_json=VALUES(mistakes_json)",
                report.reportId(), report.sessionId(), report.ownerSubjectId(), report.tenantId(), report.reportType(),
                report.status(), report.score(), report.maxScore(), report.completedCount(), report.totalCount(),
                report.calculationVersion(), report.scorePolicyVersion(), timestamp(report.generatedAt()), writeJson(report.metrics()),
                writeJson(report.evidence()), writeJson(report.mistakes()));
    }

    @Override
    public void saveMistake(AssessmentMistake mistake) {
        jdbc.update("INSERT INTO " + table("assessment_mistake")
                        + " (mistake_id, subject_id, tenant_id, item_id, question_id, error_category, rule_version, answer_hash, wrong_count, mistake_status, mastery_status, first_error_at, last_error_at, next_action_at, reason_trace_json) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE "
                        + "answer_hash=VALUES(answer_hash), wrong_count=VALUES(wrong_count), mistake_status=VALUES(mistake_status), "
                        + "mastery_status=VALUES(mastery_status), last_error_at=VALUES(last_error_at), next_action_at=VALUES(next_action_at), reason_trace_json=VALUES(reason_trace_json)",
                mistake.mistakeId(), mistake.ownerSubjectId(), mistake.tenantId(), mistake.itemId(), mistake.questionId(),
                mistake.errorCategory(), mistake.ruleVersion(), mistake.answerHash(), mistake.wrongCount(), mistake.mistakeStatus().name(),
                mistake.masteryStatus().name(), timestamp(mistake.firstErrorAt()), timestamp(mistake.lastErrorAt()),
                timestamp(mistake.nextActionAt()), writeJson(mistake.reasonTrace()));
    }

    @Override
    public Optional<IdempotencyRecord> findIdempotency(String tenantId, String subjectId, String operation,
                                                       String idempotencyKey) {
        List<IdempotencyRecord> records = jdbc.query("SELECT tenant_id, subject_id, operation, idempotency_key, request_digest, response_json, created_at FROM "
                        + table("assessment_idempotency") + " WHERE tenant_id=? AND subject_id=? AND operation=? AND idempotency_key=?",
                (rs, rowNum) -> new IdempotencyRecord(rs.getString("tenant_id"), rs.getString("subject_id"),
                        rs.getString("operation"), rs.getString("idempotency_key"), rs.getString("request_digest"),
                        readMap(rs.getString("response_json")), instant(rs, "created_at")), tenantId, subjectId, operation, idempotencyKey);
        return records.stream().findFirst();
    }

    @Override
    public IdempotencyRecord saveIdempotency(IdempotencyRecord record) {
        jdbc.update("INSERT INTO " + table("assessment_idempotency")
                        + " (tenant_id, subject_id, operation, idempotency_key, request_digest, response_json, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE tenant_id=VALUES(tenant_id)",
                record.tenantId(), record.subjectId(), record.operation(), record.idempotencyKey(), record.requestDigest(),
                writeJson(record.response()), timestamp(record.createdAt()));
        return findIdempotency(record.tenantId(), record.subjectId(), record.operation(), record.idempotencyKey()).orElse(record);
    }

    private String table(String name) {
        return "`" + schema + "`.`" + identifier(name, "table") + "`";
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw AssessmentDomainException.retryable("ASM_PERSISTENCE_SERIALIZATION", "assessment fact cannot be serialized");
        }
    }

    private ContentSnapshot readSnapshot(String value) {
        try {
            JsonNode node = objectMapper.readTree(value);
            return new ContentSnapshot(node.path("contentCode").asText(), node.path("contentVersionId").asLong(),
                    node.path("questionId").asLong(), node.path("itemId").asLong(),
                    QuestionType.valueOf(node.path("questionType").asText()), readMapNode(node.get("learnerFields")),
                    readMapNode(node.get("answerRules")), node.path("scoringVersion").asText(), node.path("maxScore").asInt(),
                    node.path("published").asBoolean());
        } catch (Exception exception) {
            throw AssessmentDomainException.retryable("ASM_PERSISTENCE_CORRUPT", "content snapshot cannot be restored");
        }
    }

    private Map<String, Object> readMap(String value) {
        try {
            return objectMapper.readValue(value == null ? "{}" : value, MAP_TYPE);
        } catch (Exception exception) {
            throw AssessmentDomainException.retryable("ASM_PERSISTENCE_CORRUPT", "assessment map cannot be restored");
        }
    }

    private Map<String, Object> readMapNode(JsonNode value) {
        try {
            return value == null || value.isNull() ? Map.of() : objectMapper.convertValue(value, MAP_TYPE);
        } catch (IllegalArgumentException exception) {
            throw AssessmentDomainException.retryable("ASM_PERSISTENCE_CORRUPT", "assessment map cannot be restored");
        }
    }

    private List<Map<String, Object>> readMapList(String value) {
        try {
            return objectMapper.readValue(value == null ? "[]" : value, MAP_LIST_TYPE);
        } catch (Exception exception) {
            throw AssessmentDomainException.retryable("ASM_PERSISTENCE_CORRUPT", "assessment list cannot be restored");
        }
    }

    private List<String> readStringList(String value) {
        try {
            return objectMapper.readValue(value == null ? "[]" : value, new TypeReference<>() { });
        } catch (Exception exception) {
            throw AssessmentDomainException.retryable("ASM_PERSISTENCE_CORRUPT", "assessment causes cannot be restored");
        }
    }

    private static String jsonText(Object value) {
        if (value instanceof byte[] bytes) return new String(bytes, StandardCharsets.UTF_8);
        return value == null ? null : String.valueOf(value);
    }

    private static String identifier(String value, String field) {
        if (value == null || !value.matches("[A-Za-z0-9_]{1,64}")) {
            throw new IllegalArgumentException(field + " is not a safe SQL identifier");
        }
        return value;
    }

    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static Instant instant(ResultSet rs, String column) {
        try {
            Timestamp value = rs.getTimestamp(column);
            return value == null ? null : value.toInstant();
        } catch (Exception exception) {
            throw new IllegalStateException("failed to read timestamp " + column, exception);
        }
    }

    private static Boolean nullableBoolean(ResultSet rs, String column) {
        try {
            Object value = rs.getObject(column);
            return value == null ? null : rs.getBoolean(column);
        } catch (Exception exception) {
            throw new IllegalStateException("failed to read boolean " + column, exception);
        }
    }

    private static Long nullableLong(ResultSet rs, String column) {
        try {
            long value = rs.getLong(column);
            return rs.wasNull() ? null : value;
        } catch (Exception exception) {
            throw new IllegalStateException("failed to read number " + column, exception);
        }
    }

    private static SessionBuilder requiredBuilder(Map<String, SessionBuilder> builders, String sessionId) {
        SessionBuilder builder = builders.get(sessionId);
        if (builder == null) throw AssessmentDomainException.retryable("ASM_PERSISTENCE_CORRUPT", "fact references an unknown session");
        return builder;
    }

    private static final class SessionBuilder {
        private final String sessionId;
        private final AssessmentPrincipal owner;
        private final AssessmentSessionType type;
        private final Instant createdAt;
        private final Instant deadlineAt;
        private final AssessmentSessionStatus status;
        private final Instant startedAt;
        private final Instant closedAt;
        private final List<AssessmentSession.Exercise> exercises = new ArrayList<>();
        private final List<AssessmentAttempt> attempts = new ArrayList<>();
        private AssessmentCheckpoint checkpoint;

        private SessionBuilder(ResultSet rs) {
            try {
                sessionId = rs.getString("session_id");
                owner = AssessmentPrincipal.authenticated(rs.getString("subject_id"), rs.getString("tenant_id"));
                type = AssessmentSessionType.valueOf(rs.getString("session_type"));
                createdAt = instant(rs, "created_at");
                deadlineAt = instant(rs, "deadline_at");
                status = AssessmentSessionStatus.valueOf(rs.getString("session_status"));
                startedAt = instant(rs, "started_at");
                closedAt = instant(rs, "closed_at");
            } catch (Exception exception) {
                throw AssessmentDomainException.retryable("ASM_PERSISTENCE_CORRUPT", "session cannot be restored");
            }
        }
    }
}
