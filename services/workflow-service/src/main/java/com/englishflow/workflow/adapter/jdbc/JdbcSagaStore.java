package com.englishflow.workflow.adapter.jdbc;

import com.englishflow.workflow.domain.SagaStatus;
import com.englishflow.workflow.domain.SagaStore;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;

/**
 * The saga store on MySQL.
 *
 * <p>Every statement is scoped to {@code workflow_service}, which is this owner's own schema: the service
 * holds no domain facts and never writes another owner's tables. The status columns use the enum's name, so
 * a value that is not a known status is a read error rather than a silently unknown state.
 */
public class JdbcSagaStore implements SagaStore {

    private final JdbcTemplate jdbc;

    public JdbcSagaStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void start(String sagaId, String sagaName, String correlationId) {
        // The unique key on (saga_name, correlation_id) means a repeated request cannot start a second saga for
        // the same correlation, which is what makes starting a saga safe to retry.
        jdbc.update("""
                INSERT INTO workflow_service.saga_instance
                    (saga_id, saga_name, correlation_id, status, attempt_count, started_at)
                VALUES (?, ?, ?, 'STARTED', 0, UTC_TIMESTAMP(6))
                """, sagaId, sagaName, correlationId);
    }

    @Override
    public void recordStepPlanned(String sagaId, String stepName, int stepOrder, String compensationName) {
        // Inserted with the compensation already present. A duplicate is ignored rather than overwriting,
        // so a retry cannot replace a recorded compensation with a different one.
        jdbc.update("""
                INSERT INTO workflow_service.saga_step
                    (saga_id, step_name, step_order, status, compensation_name, compensation_state, attempt_count)
                VALUES (?, ?, ?, 'PLANNED', ?, 'PENDING', 0)
                ON DUPLICATE KEY UPDATE step_order = VALUES(step_order)
                """, sagaId, stepName, stepOrder, compensationName);
    }

    @Override
    public void markStepStarted(String sagaId, String stepName) {
        jdbc.update("""
                UPDATE workflow_service.saga_step
                   SET status = 'RUNNING', started_at = COALESCE(started_at, UTC_TIMESTAMP(6)),
                       attempt_count = attempt_count + 1
                 WHERE saga_id = ? AND step_name = ?
                """, sagaId, stepName);
    }

    @Override
    public void markStepCompleted(String sagaId, String stepName) {
        jdbc.update("""
                UPDATE workflow_service.saga_step
                   SET status = 'COMPLETED', finished_at = UTC_TIMESTAMP(6)
                 WHERE saga_id = ? AND step_name = ?
                """, sagaId, stepName);
    }

    @Override
    public void markStepFailed(String sagaId, String stepName, String errorCode, String errorMessage) {
        jdbc.update("""
                UPDATE workflow_service.saga_step
                   SET status = 'FAILED', finished_at = UTC_TIMESTAMP(6),
                       last_error_code = ?, last_error_message = ?
                 WHERE saga_id = ? AND step_name = ?
                """, errorCode, errorMessage, sagaId, stepName);
    }

    @Override
    public void markCompensation(String sagaId, String stepName, boolean succeeded, String errorMessage) {
        jdbc.update("""
                UPDATE workflow_service.saga_step
                   SET compensation_state = ?, last_error_message = COALESCE(?, last_error_message)
                 WHERE saga_id = ? AND step_name = ?
                """, succeeded ? "APPLIED" : "FAILED", errorMessage, sagaId, stepName);
    }

    @Override
    public void updateStatus(String sagaId, SagaStatus status, String currentStep, String errorCode, String errorMessage) {
        jdbc.update("""
                UPDATE workflow_service.saga_instance
                   SET status = ?, current_step = ?, last_error_code = ?, last_error_message = ?,
                       finished_at = CASE WHEN ? THEN UTC_TIMESTAMP(6) ELSE finished_at END
                 WHERE saga_id = ?
                """, status.name(), currentStep, errorCode, errorMessage, status.isTerminal(), sagaId);
    }

    @Override
    public Optional<SagaRecord> find(String sagaId) {
        List<SagaRecord> rows = jdbc.query("""
                SELECT saga_id, saga_name, correlation_id, status, current_step, attempt_count,
                       last_error_code, last_error_message
                  FROM workflow_service.saga_instance WHERE saga_id = ?
                """, (resultSet, index) -> new SagaRecord(
                resultSet.getString("saga_id"), resultSet.getString("saga_name"),
                resultSet.getString("correlation_id"), SagaStatus.valueOf(resultSet.getString("status")),
                resultSet.getString("current_step"), resultSet.getInt("attempt_count"),
                resultSet.getString("last_error_code"), resultSet.getString("last_error_message")), sagaId);
        return rows.stream().findFirst();
    }

    @Override
    public List<SagaStepRecord> steps(String sagaId) {
        return jdbc.query("""
                SELECT saga_id, step_name, step_order, status, compensation_name, compensation_state,
                       attempt_count, last_error_code, last_error_message
                  FROM workflow_service.saga_step WHERE saga_id = ? ORDER BY step_order
                """, (resultSet, index) -> new SagaStepRecord(
                resultSet.getString("saga_id"), resultSet.getString("step_name"), resultSet.getInt("step_order"),
                resultSet.getString("status"), resultSet.getString("compensation_name"),
                resultSet.getString("compensation_state"), resultSet.getInt("attempt_count"),
                resultSet.getString("last_error_code"), resultSet.getString("last_error_message")), sagaId);
    }

    @Override
    public List<SagaRecord> unfinished(int limit) {
        // Ordered oldest first and read in one statement, so a recovery sweep cannot walk the set twice and
        // compensate the same saga in two passes.
        return jdbc.query("""
                SELECT saga_id, saga_name, correlation_id, status, current_step, attempt_count,
                       last_error_code, last_error_message
                  FROM workflow_service.saga_instance
                 WHERE status NOT IN ('COMPLETED','COMPENSATED','COMPENSATION_FAILED')
                 ORDER BY updated_at, saga_id LIMIT ?
                """, (resultSet, index) -> new SagaRecord(
                resultSet.getString("saga_id"), resultSet.getString("saga_name"),
                resultSet.getString("correlation_id"), SagaStatus.valueOf(resultSet.getString("status")),
                resultSet.getString("current_step"), resultSet.getInt("attempt_count"),
                resultSet.getString("last_error_code"), resultSet.getString("last_error_message")), limit);
    }
}
