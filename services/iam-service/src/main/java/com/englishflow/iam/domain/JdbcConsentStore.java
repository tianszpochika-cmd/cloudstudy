package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Append-only IAM consent store; withdrawal creates a new row and never deletes history. */
public final class JdbcConsentStore implements ConsentStore {

    private final JdbcTemplate jdbc;

    public JdbcConsentStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public ConsentRecord append(ConsentRecord record) {
        try {
            jdbc.update(
                    "INSERT INTO iam_consent (consent_id, principal_id, consent_type, policy_version, "
                            + "status, granted_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(), record.principalId().toString(), record.type().name(),
                    record.version().value(), record.accepted() ? "GRANTED" : "WITHDRAWN",
                    Timestamp.from(record.recordedAt()), record.accepted() ? null : Timestamp.from(record.recordedAt()));
            return record;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type) {
        return history(principalId, type).stream().reduce((first, second) -> second);
    }

    @Override
    public List<ConsentRecord> history(PrincipalId principalId, ConsentType type) {
        try {
            return jdbc.query(
                    "SELECT principal_id, consent_type, policy_version, status, granted_at "
                            + "FROM iam_consent WHERE principal_id = ? AND consent_type = ? ORDER BY granted_at ASC",
                    (ResultSet rs, int rowNum) -> map(rs), principalId.toString(), type.name());
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private static ConsentRecord map(ResultSet rs) throws java.sql.SQLException {
        PrincipalId principal = new PrincipalId(UUID.fromString(rs.getString("principal_id")));
        return new ConsentRecord(principal, TenantScope.derive(principal),
                ConsentType.valueOf(rs.getString("consent_type")),
                new ConsentVersion(rs.getString("policy_version")),
                "GRANTED".equals(rs.getString("status")),
                rs.getTimestamp("granted_at").toInstant());
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
