package com.englishflow.notification.adapter.jdbc;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;
import com.englishflow.notification.domain.WorkflowState;
import com.englishflow.notification.domain.WorkflowTask;
import com.englishflow.notification.port.WorkflowPort;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Minimal durable workflow metadata adapter used by notification delivery/replay. */
public final class JdbcWorkflowPort implements WorkflowPort {

    private final JdbcTemplate jdbc;

    public JdbcWorkflowPort(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public WorkflowTask enqueue(String tenantId, String principalId, String action, String aggregateType,
            String aggregateId, int maxAttempts, Instant now) {
        WorkflowTask task = new WorkflowTask("wf-" + UUID.randomUUID(), tenantId, principalId, action,
                aggregateType, aggregateId, WorkflowState.QUEUED, 0, maxAttempts, null, now, now);
        try {
            jdbc.update("""
                    INSERT INTO notification_workflow_task
                        (task_id, tenant_id, principal_id, action, aggregate_type, aggregate_id, state,
                         attempt, max_attempts, reason_code, next_run_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, task.taskId(), task.tenantId(), task.principalId(), task.action(), task.aggregateType(),
                    task.aggregateId(), task.state().name(), task.attempt(), task.maxAttempts(), task.reasonCode(),
                    Timestamp.from(task.nextRunAt()), Timestamp.from(task.updatedAt()));
            return task;
        } catch (DuplicateKeyException duplicate) {
            return findByAggregate(aggregateType, aggregateId).orElseThrow(this::unavailable);
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public WorkflowTask scheduleRetry(String taskId, String reasonCode, Instant nextRunAt) {
        WorkflowTask current = require(taskId);
        int nextAttempt = current.attempt() + 1;
        if (nextAttempt > current.maxAttempts()) return moveToDlq(taskId, reasonCode, nextRunAt);
        return replace(current.transition(WorkflowState.RETRY_SCHEDULED, nextAttempt, reasonCode, nextRunAt));
    }

    @Override
    public WorkflowTask complete(String taskId, Instant now) {
        WorkflowTask current = require(taskId);
        return replace(current.transition(WorkflowState.SUCCEEDED, Math.max(1, current.attempt()), null, now));
    }

    @Override
    public WorkflowTask moveToDlq(String taskId, String reasonCode, Instant now) {
        WorkflowTask current = require(taskId);
        return replace(current.transition(WorkflowState.DEAD_LETTER, Math.max(1, current.attempt()), reasonCode, now));
    }

    @Override
    public Optional<WorkflowTask> find(String taskId) {
        try {
            return jdbc.query(selectSql() + " WHERE task_id = ?", (rs, row) -> map(rs), taskId).stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<WorkflowTask> findByAggregate(String aggregateType, String aggregateId) {
        try {
            return jdbc.query(selectSql() + " WHERE aggregate_type = ? AND aggregate_id = ?",
                    (rs, row) -> map(rs), aggregateType, aggregateId).stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public RecoveryResult recover(RecoveryCommand command, Instant now) {
        WorkflowTask current = require(command.taskId());
        WorkflowTask next = switch (command.action()) {
            case RETRY -> {
                if (current.attempt() >= current.maxAttempts()) {
                    throw new NotificationDomainException(NotificationDomainException.Code.RECOVERY_NOT_ALLOWED,
                            "workflow retry budget is exhausted");
                }
                yield current.transition(WorkflowState.RETRY_SCHEDULED, current.attempt() + 1,
                        command.reasonCode(), now);
            }
            case REPLAY -> current.transition(WorkflowState.QUEUED, current.attempt(), command.reasonCode(), now);
            case CANCEL -> current.transition(WorkflowState.FAILED, Math.max(1, current.attempt()),
                    command.reasonCode(), now);
            case MANUAL_REVIEW -> current.transition(WorkflowState.MANUAL_RECOVERY, Math.max(1, current.attempt()),
                    command.reasonCode(), now);
        };
        replace(next);
        return new RecoveryResult(next.taskId(), command.action(), next.state(), command.reasonCode(), now);
    }

    private WorkflowTask replace(WorkflowTask task) {
        try {
            int updated = jdbc.update("""
                    UPDATE notification_workflow_task
                    SET state = ?, attempt = ?, reason_code = ?, next_run_at = ?, updated_at = ?
                    WHERE task_id = ?
                    """, task.state().name(), task.attempt(), task.reasonCode(), Timestamp.from(task.nextRunAt()),
                    Timestamp.from(task.updatedAt()), task.taskId());
            if (updated != 1) throw unavailable();
            return task;
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    private WorkflowTask require(String taskId) {
        return find(taskId).orElseThrow(() -> new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                "workflow task was not found"));
    }

    private static WorkflowTask map(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp next = rs.getTimestamp("next_run_at");
        Timestamp updated = rs.getTimestamp("updated_at");
        return new WorkflowTask(rs.getString("task_id"), rs.getString("tenant_id"), rs.getString("principal_id"),
                rs.getString("action"), rs.getString("aggregate_type"), rs.getString("aggregate_id"),
                WorkflowState.valueOf(rs.getString("state")), rs.getInt("attempt"), rs.getInt("max_attempts"),
                rs.getString("reason_code"), next.toInstant(), updated.toInstant());
    }

    private static String selectSql() {
        return "SELECT task_id, tenant_id, principal_id, action, aggregate_type, aggregate_id, state, attempt, "
                + "max_attempts, reason_code, next_run_at, updated_at FROM notification_workflow_task";
    }

    private NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification durable persistence is unavailable");
    }
}
