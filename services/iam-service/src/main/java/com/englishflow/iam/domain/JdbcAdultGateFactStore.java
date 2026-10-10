package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Objects;

/** JDBC adapter for the IAM-owned adult Gate columns on iam_principal. */
public class JdbcAdultGateFactStore implements AdultGateFactStore {

    private final JdbcTemplate jdbc;

    public JdbcAdultGateFactStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public AdultGateFact find(PrincipalId principalId, Instant fallbackEvaluatedAt) {
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(fallbackEvaluatedAt, "fallbackEvaluatedAt");
        try {
            return jdbc.query(
                    "SELECT adult_gate_status, adult_gate_version, adult_verified_at, created_at "
                            + "FROM iam_principal WHERE principal_id = ?",
                    (ResultSet rs, int rowNum) -> map(rs, fallbackEvaluatedAt),
                    principalId.toString()).stream().findFirst()
                    .orElseThrow(JdbcAdultGateFactStore::unavailable);
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public AdultGateFact approve(PrincipalId principalId, String policyVersion, Instant evaluatedAt) {
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(policyVersion, "policyVersion");
        Objects.requireNonNull(evaluatedAt, "evaluatedAt");
        try {
            int updated = jdbc.update(
                    "UPDATE iam_principal SET adult_gate_status = 'APPROVED', "
                            + "adult_gate_version = ?, adult_verified_at = ? WHERE principal_id = ? "
                            + "AND adult_gate_status <> 'REJECTED' "
                            + "AND NOT (adult_gate_status = 'APPROVED' AND adult_gate_version = ? "
                            + "AND adult_verified_at IS NOT NULL)",
                    policyVersion, Timestamp.from(evaluatedAt), principalId.toString(), policyVersion);
            if (updated != 1) {
                AdultGateFact current = find(principalId, evaluatedAt);
                if ("REJECTED".equals(current.status())) {
                    return current;
                }
                if (!"APPROVED".equals(current.status()) || !policyVersion.equals(current.policyVersion())) {
                    throw unavailable();
                }
                return current;
            }
            return find(principalId, evaluatedAt);
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public AdultGateFact invalidate(PrincipalId principalId, String policyVersion, Instant evaluatedAt) {
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(policyVersion, "policyVersion");
        Objects.requireNonNull(evaluatedAt, "evaluatedAt");
        try {
            int updated = jdbc.update(
                    "UPDATE iam_principal SET adult_gate_status = 'REJECTED', "
                            + "adult_gate_version = ?, adult_verified_at = NULL WHERE principal_id = ? "
                            + "AND NOT (adult_gate_status = 'REJECTED' AND adult_gate_version = ?)",
                    policyVersion, principalId.toString(), policyVersion);
            if (updated != 1) {
                AdultGateFact current = find(principalId, evaluatedAt);
                if (!"REJECTED".equals(current.status()) || !policyVersion.equals(current.policyVersion())) {
                    throw unavailable();
                }
                return current;
            }
            return find(principalId, evaluatedAt);
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private static AdultGateFact map(ResultSet rs, Instant fallbackEvaluatedAt) throws java.sql.SQLException {
        String status = rs.getString("adult_gate_status");
        String policyVersion = rs.getString("adult_gate_version");
        Timestamp verifiedAt = rs.getTimestamp("adult_verified_at");
        Timestamp createdAt = rs.getTimestamp("created_at");
        Instant evaluatedAt = verifiedAt == null
                ? createdAt == null ? fallbackEvaluatedAt : createdAt.toInstant()
                : verifiedAt.toInstant();
        String normalizedStatus = status == null || status.isBlank() ? "PENDING" : status;
        String normalizedVersion = policyVersion == null || policyVersion.isBlank()
                ? "b30-adult-v1" : policyVersion;
        return new AdultGateFact(normalizedStatus, normalizedVersion, evaluatedAt,
                !"APPROVED".equals(normalizedStatus));
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
