package com.englishflow.iam.domain;

import com.englishflow.iam.web.IamRequestCorrelationContext;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.util.Objects;

/** Durable append-only IAM decision sink. Safe audit dimensions only are persisted. */
public final class JdbcAuditFactPort implements AuditFactPort {

    private static final String POLICY_VERSION = "b30-rbac-v1";

    private final JdbcTemplate jdbc;

    public JdbcAuditFactPort(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public void append(AuditDecision decision) {
        Objects.requireNonNull(decision, "decision");
        try {
            IamRequestCorrelationContext.Correlation correlation =
                    IamRequestCorrelationContext.current().orElse(null);
            jdbc.update(
                    "INSERT INTO iam_decision_audit "
                            + "(decision_id, request_id, trace_id, principal_id, tenant_id, action_code, "
                            + "resource_type, policy_version, decision, reason_code, created_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    decision.decisionId().toString(),
                    correlation == null ? "iam-" + decision.decisionId() : correlation.requestId(),
                    correlation == null ? "iam-" + decision.decisionId() : correlation.traceId(),
                    decision.principalId().toString(),
                    decision.tenantId(),
                    decision.code().wireValue(),
                    decision.decisionType(),
                    POLICY_VERSION,
                    decision.allowed() ? "ALLOW" : "DENY",
                    decision.code().wireValue(),
                    Timestamp.from(decision.occurredAt()));
        } catch (DataAccessException exception) {
            throw new IamPolicyException(
                    IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                    "iam.persistence.unavailable");
        }
    }
}
