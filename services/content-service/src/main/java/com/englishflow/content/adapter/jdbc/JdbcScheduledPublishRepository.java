package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ScheduledPublishTask;
import com.englishflow.content.port.ScheduledPublishRepository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;

/** Content-service-owned MySQL schedule store. */
public final class JdbcScheduledPublishRepository implements ScheduledPublishRepository {

    private static final String COLUMNS = """
            task_id, tenant_id, pack_code, target_type, target_ref, expected_state_version,
            run_at, status, reason_code, cohort, failure_code, created_by, created_at, updated_at
            """;

    private final JdbcTemplate jdbc;

    public JdbcScheduledPublishRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<ScheduledPublishTask> findById(String taskId) {
        List<ScheduledPublishTask> rows = jdbc.query(
                "SELECT " + COLUMNS + " FROM scheduled_publish_task WHERE task_id = ?",
                (resultSet, row) -> mapTask(resultSet), taskId);
        return rows.stream().findFirst();
    }

    @Override
    public List<ScheduledPublishTask> listByPack(String packCode, int limit) {
        return jdbc.query(
                "SELECT " + COLUMNS + " FROM scheduled_publish_task WHERE tenant_id = 'platform' AND pack_code = ? ORDER BY run_at DESC LIMIT ?",
                (resultSet, row) -> mapTask(resultSet), packCode, Math.max(1, Math.min(limit, 100)));
    }

    @Override
    public List<ScheduledPublishTask> dueTasks(Instant now, int limit) {
        return jdbc.query(
                "SELECT " + COLUMNS + " FROM scheduled_publish_task WHERE tenant_id = 'platform' AND status = 'SCHEDULED' AND run_at <= ? ORDER BY run_at LIMIT ?",
                (resultSet, row) -> mapTask(resultSet),
                JdbcContentJson.timestamp(now), Math.max(1, Math.min(limit, 50)));
    }

    @Override
    public void save(ScheduledPublishTask task) {
        jdbc.update("""
                INSERT INTO scheduled_publish_task
                    (task_id, tenant_id, pack_code, target_type, target_ref, expected_state_version,
                     run_at, status, reason_code, cohort, failure_code, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), pack_code = VALUES(pack_code),
                    target_type = VALUES(target_type), target_ref = VALUES(target_ref),
                    expected_state_version = VALUES(expected_state_version), run_at = VALUES(run_at),
                    status = VALUES(status), reason_code = VALUES(reason_code),
                    cohort = VALUES(cohort),
                    failure_code = VALUES(failure_code), created_by = VALUES(created_by),
                    created_at = VALUES(created_at), updated_at = VALUES(updated_at)
                """,
                task.taskId(), task.tenantId(), task.packCode(), task.targetType(), task.targetRef(),
                task.expectedStateVersion(), JdbcContentJson.timestamp(task.runAt()), task.status(),
                task.reasonCode(), task.cohort(), task.failureCode(), task.createdBy(),
                JdbcContentJson.timestamp(task.createdAt()), JdbcContentJson.timestamp(task.updatedAt()));
    }

    private ScheduledPublishTask mapTask(ResultSet resultSet) throws SQLException {
        Object expected = resultSet.getObject("expected_state_version");
        Long expectedVersion = null;
        if (expected instanceof Number number) {
            expectedVersion = number.longValue();
        } else if (resultSet.getString("expected_state_version") != null) {
            try {
                expectedVersion = Long.parseLong(resultSet.getString("expected_state_version"));
            } catch (NumberFormatException invalid) {
                throw ContentOperationException.unavailable("SCHEDULE_FACT_CORRUPT",
                        "stored schedule pin cannot be read");
            }
        }
        return new ScheduledPublishTask(
                resultSet.getString("task_id"), resultSet.getString("tenant_id"),
                resultSet.getString("pack_code"), resultSet.getString("target_type"),
                resultSet.getString("target_ref"), expectedVersion,
                JdbcContentJson.instant(resultSet, "run_at"), resultSet.getString("status"),
                resultSet.getString("reason_code"), resultSet.getString("cohort"),
                resultSet.getString("failure_code"),
                resultSet.getString("created_by"), JdbcContentJson.instant(resultSet, "created_at"),
                JdbcContentJson.instant(resultSet, "updated_at"));
    }
}
