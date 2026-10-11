package com.englishflow.workflow.adapter.jdbc;

import com.englishflow.workflow.domain.SagaStateMachine;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Job leases on MySQL.
 *
 * <p>The acquire is a conditional update, not a read followed by a write. Two instances starting at the same
 * moment would both read an expired lease and both decide they may run the job; letting the database decide
 * with a single statement is what makes the answer correct under concurrency rather than merely likely.
 *
 * <p>An expired lease is reclaimable so a crashed holder cannot block a job forever, and the attempt count is
 * incremented on acquire rather than on completion, so a job that kills its process is visible as repeated
 * attempts instead of looking like it never ran.
 */
public class JdbcJobLeaseStore {

    /** The outcome of trying to take a lease. */
    public record LeaseAttempt(boolean acquired, String holder, String reason) {
    }

    private final JdbcTemplate jdbc;
    private final String holder;

    public JdbcJobLeaseStore(JdbcTemplate jdbc, String holder) {
        this.jdbc = jdbc;
        this.holder = holder;
    }

    /** Registers a job if it is not known yet, so a deployment can add one without a migration. */
    public void declare(String jobName, String cronExpression) {
        jdbc.update(WorkflowTables.sql("""
                INSERT INTO workflow_service.scheduled_job (job_name, cron_expression, enabled, next_run_at)
                VALUES (?, ?, 1, UTC_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE cron_expression = VALUES(cron_expression)
                """), jobName, cronExpression);
    }

    /**
     * Takes the lease if it is free, already ours, or expired.
     *
     * <p>One statement decides, and its WHERE clause is the whole rule: nobody holds it, or we do, or the
     * holder's lease has run out.
     */
    public LeaseAttempt acquire(String jobName, Duration leaseDuration) {
        long seconds = Math.max(1, leaseDuration.toSeconds());
        int updated = jdbc.update(WorkflowTables.sql("""
                UPDATE workflow_service.scheduled_job
                   SET lease_owner = ?,
                       lease_expires_at = DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? SECOND),
                       attempt_count = attempt_count + 1
                 WHERE job_name = ?
                   AND enabled = 1
                   AND (lease_owner IS NULL OR lease_owner = ?
                        OR lease_expires_at IS NULL OR lease_expires_at <= UTC_TIMESTAMP(6))
                """), holder, seconds, jobName, holder);
        if (updated == 1) {
            return new LeaseAttempt(true, holder, null);
        }
        // Nothing was updated, so something refused it: either the job is unknown or disabled, or another
        // holder's lease is still running. Which one is reported, because they call for different responses.
        List<String> rows = jdbc.query(WorkflowTables.sql("""
                SELECT lease_owner, enabled FROM workflow_service.scheduled_job WHERE job_name = ?
                """), (resultSet, index) -> resultSet.getString("lease_owner") + "|" + resultSet.getInt("enabled"), jobName);
        if (rows.isEmpty()) {
            return new LeaseAttempt(false, null, "no such job");
        }
        String[] parts = rows.getFirst().split("\\|");
        if (!"1".equals(parts[1])) {
            return new LeaseAttempt(false, parts[0].equals("null") ? null : parts[0], "job is disabled");
        }
        return new LeaseAttempt(false, parts[0].equals("null") ? null : parts[0], "another holder's lease is still running");
    }

    /** Records the outcome of a run and releases the lease so the next tick can take it. */
    public void finish(String jobName, String outcome, String errorMessage, Instant nextRunAt) {
        jdbc.update(WorkflowTables.sql("""
                UPDATE workflow_service.scheduled_job
                   SET lease_owner = NULL, lease_expires_at = NULL, last_outcome = ?,
                       last_error_message = ?, last_run_at = UTC_TIMESTAMP(6), next_run_at = ?
                 WHERE job_name = ? AND lease_owner = ?
                """), outcome, errorMessage, java.sql.Timestamp.from(nextRunAt), jobName, holder);
    }

    /** Releases the lease without recording an outcome, for a run that failed before doing anything. */
    public void abandon(String jobName) {
        jdbc.update(WorkflowTables.sql("""
                UPDATE workflow_service.scheduled_job
                   SET lease_owner = NULL, lease_expires_at = NULL
                 WHERE job_name = ? AND lease_owner = ?
                """), jobName, holder);
    }

    /** Whether the given holder currently holds the lease, read back rather than assumed. */
    public boolean holds(String jobName, String candidate) {
        List<String> rows = jdbc.query(WorkflowTables.sql("""
                SELECT lease_owner FROM workflow_service.scheduled_job WHERE job_name = ?
                """), (resultSet, index) -> resultSet.getString("lease_owner"), jobName);
        return !rows.isEmpty() && candidate.equals(rows.getFirst());
    }

    /** Jobs that are due and whose lease is free or expired. */
    public List<String> due(int limit) {
        return jdbc.query(WorkflowTables.sql("""
                SELECT job_name FROM workflow_service.scheduled_job
                 WHERE enabled = 1 AND (next_run_at IS NULL OR next_run_at <= UTC_TIMESTAMP(6))
                   AND (lease_owner IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= UTC_TIMESTAMP(6))
                 ORDER BY next_run_at LIMIT ?
                """), (resultSet, index) -> resultSet.getString("job_name"), limit);
    }

    /** The domain rule, exposed so a caller can ask without touching the database. */
    public static boolean mayRun(String leaseOwner, Long expiresAt, String self, long now) {
        return SagaStateMachine.mayRunJob(leaseOwner, expiresAt, self, now);
    }

    /** The holder this store acts as. */
    public String holder() {
        return holder;
    }

    /** Reads a job row for evidence. */
    public Optional<String> describe(String jobName) {
        // Every nullable column is wrapped: CONCAT returns NULL if any argument is NULL, so a released lease
        // made this return an empty Optional and the caller saw a NullPointerException instead of a row.
        List<String> rows = jdbc.query(WorkflowTables.sql("""
                SELECT CONCAT(IFNULL(lease_owner,'null'), '|', IFNULL(lease_expires_at,'null'), '|',
                              attempt_count, '|', IFNULL(last_outcome,'null'))
                  FROM workflow_service.scheduled_job WHERE job_name = ?
                """), (resultSet, index) -> resultSet.getString(1), jobName);
        return rows.stream().filter(java.util.Objects::nonNull).findFirst();
    }
}
