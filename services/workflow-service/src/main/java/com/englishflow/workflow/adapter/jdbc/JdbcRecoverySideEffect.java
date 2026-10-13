package com.englishflow.workflow.adapter.jdbc;

import com.englishflow.workflow.application.RecoverySideEffectPort;
import com.englishflow.workflow.domain.ManualRecoveryRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Locale;
import java.util.UUID;

/**
 * Executes allowlisted recoveries against sibling owner schemas on the same MySQL.
 * Unknown subject/action pairs fail closed so EXECUTED is never claimed for a no-op.
 */
public final class JdbcRecoverySideEffect implements RecoverySideEffectPort {

    private final JdbcTemplate jdbc;

    public JdbcRecoverySideEffect(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public String apply(String recoveryId, String subjectType, String subjectId, String action, String executor) {
        String type = subjectType == null ? "" : subjectType.trim().toUpperCase(Locale.ROOT);
        String act = action == null ? "" : action.trim().toUpperCase(Locale.ROOT);
        if ("TICKET".equals(type) && "REOPEN".equals(act)) {
            int updated = jdbc.update("""
                    UPDATE admin_ops_service.support_ticket
                       SET ticket_status = 'IN_PROGRESS',
                           ticket_version = ticket_version + 1,
                           updated_at = UTC_TIMESTAMP(6)
                     WHERE ticket_id = ?
                       AND ticket_status IN ('RESOLVED', 'CLOSED')
                    """, subjectId);
            String detail = updated == 1
                    ? "support_ticket -> IN_PROGRESS"
                    : "ticket not in RESOLVED/CLOSED or not visible";
            jdbc.update("""
                    INSERT INTO recovery_side_effect_log
                        (effect_id, recovery_id, subject_type, subject_id, action, executor, outcome, detail, occurred_at)
                    VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))
                    """, UUID.randomUUID().toString(), recoveryId, type, subjectId, act, executor,
                    updated == 1 ? "APPLIED" : "FAILED", detail);
            if (updated != 1) {
                throw new ManualRecoveryRequest.RecoveryNotAllowed(detail);
            }
            return detail;
        }
        throw new ManualRecoveryRequest.RecoveryNotAllowed(
                "no executable recovery for " + type + "/" + act + "; supported: TICKET/REOPEN");
    }
}
