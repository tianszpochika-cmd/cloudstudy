package com.englishflow.workflow.adapter.jdbc;

import com.englishflow.workflow.application.ManualRecoveryService;
import com.englishflow.workflow.domain.ManualRecoveryRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Manual recoveries in MySQL.
 *
 * <p>This is the implementation the service was missing. {@code RecoveryStore} was declared and the tests provided their
 * own, so nothing failed until the application was started for the first time and Spring had no bean to inject: a
 * service whose tests all pass and which cannot boot.
 *
 * <p>A recovery is rehydrated from its row and asked to decide for itself, rather than being handed a decision. That is
 * what makes the two-person rule hold however the caller behaves: the domain type refuses a self-approval, and this
 * class never constructs one.
 */
public class JdbcRecoveryStore implements ManualRecoveryService.RecoveryStore {

    private final JdbcTemplate jdbc;

    public JdbcRecoveryStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void save(ManualRecoveryRequest request, String subjectType, String subjectId, String action, String reason) {
        jdbc.update(WorkflowTables.sql("""
                INSERT INTO workflow_service.manual_recovery_request
                    (recovery_id, subject_type, subject_id, action, reason, status, requested_by, requested_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(6))
                """), request.recoveryId(), subjectType, subjectId, action, reason, request.status().name(),
                request.requestedBy());
    }

    @Override
    public void update(ManualRecoveryRequest request) {
        jdbc.update(WorkflowTables.sql("""
                UPDATE workflow_service.manual_recovery_request
                   SET status = ?, approved_by = ?, approved_at = CASE WHEN ? IS NULL THEN approved_at ELSE UTC_TIMESTAMP(6) END
                 WHERE recovery_id = ?
                """), request.status().name(), request.approvedBy(), request.approvedBy(), request.recoveryId());
    }

    @Override
    public void recordReceipt(ManualRecoveryRequest request, String executor) {
        jdbc.update(WorkflowTables.sql("""
                UPDATE workflow_service.manual_recovery_request
                   SET executed_at = UTC_TIMESTAMP(6)
                 WHERE recovery_id = ?
                """), request.recoveryId());
        jdbc.update(WorkflowTables.sql("""
                INSERT INTO workflow_service.workflow_receipt
                    (receipt_id, subject_type, subject_id, operation, outcome, detail_json, actor, occurred_at)
                VALUES (UUID(), 'manual_recovery', ?, 'execute', ?, NULL, ?, UTC_TIMESTAMP(6))
                """), request.recoveryId(), request.status().name(), executor);
    }

    @Override
    public Optional<ManualRecoveryService.StoredRecovery> find(String recoveryId) {
        List<ManualRecoveryService.StoredRecovery> rows = jdbc.query(WorkflowTables.sql("""
                SELECT recovery_id, subject_type, subject_id, action, reason, status, requested_by, approved_by
                  FROM workflow_service.manual_recovery_request
                 WHERE recovery_id = ?
                 FOR UPDATE
                """), (resultSet, index) -> new ManualRecoveryService.StoredRecovery(
                ManualRecoveryRequest.rehydrated(resultSet.getString("recovery_id"),
                        resultSet.getString("requested_by"),
                        ManualRecoveryRequest.Status.valueOf(resultSet.getString("status")),
                        resultSet.getString("approved_by"), null),
                resultSet.getString("subject_type"), resultSet.getString("subject_id"),
                resultSet.getString("action"), resultSet.getString("reason")), recoveryId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    /** Kept so the class compiles against a driver that hands back timestamps rather than reading them itself. */
    static Timestamp now() {
        return Timestamp.from(Instant.now());
    }
}
