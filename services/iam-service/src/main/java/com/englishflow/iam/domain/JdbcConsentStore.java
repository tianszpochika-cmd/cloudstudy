package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Append-only IAM consent store. The history table is immutable evidence and the current table
 * is a small projection used for deterministic reads. A lock row serializes first writes where
 * no history row exists yet; the outer IAM transaction supplies atomic CAS and audit semantics.
 */
public class JdbcConsentStore implements ConsentStore {

    private static final String ZERO_ID = "00000000-0000-0000-0000-000000000000";
    private final JdbcTemplate jdbc;

    public JdbcConsentStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public ConsentRecord append(ConsentRecord record) {
        try {
            lockKey(record.principalId(), record.type());
            jdbc.update(
                    "INSERT INTO iam_consent (consent_id, principal_id, consent_type, purpose, "
                            + "required_scope, document_version, document_digest, policy_version, policy_digest, "
                            + "status, granted_at, effective_at, revoked_at, withdrawal_effect, revoke_sessions) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    record.consentId().toString(), record.principalId().toString(), record.type().name(),
                    record.purpose(), record.requirementScope(), record.documentVersion().value(),
                    record.documentDigest(), record.policyVersion().value(), record.policyDigest(),
                    record.accepted() ? "GRANTED" : "WITHDRAWN", Timestamp.from(record.recordedAt()),
                    Timestamp.from(record.effectiveAt()), record.accepted() ? null : Timestamp.from(record.recordedAt()),
                    record.withdrawalEffect().name(), record.revokeSessions() ? 1 : 0);
            jdbc.update(
                    "INSERT INTO iam_consent_current (principal_id, consent_type, consent_id, updated_at) "
                            + "VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE consent_id = VALUES(consent_id), "
                            + "updated_at = VALUES(updated_at)",
                    record.principalId().toString(), record.type().name(), record.consentId().toString(),
                    Timestamp.from(record.recordedAt()));
            // DATETIME(6) is the durable precision. Return the persisted representation so the
            // first response and a later process-restart read have identical timestamps/facts.
            return find(record.principalId(), record.type()).orElse(record);
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type) {
        try {
            Optional<ConsentRecord> current = jdbc.query(
                    "SELECT c.principal_id, c.consent_type, c.purpose, c.required_scope, c.document_version, "
                            + "c.document_digest, c.policy_version, c.policy_digest, c.status, c.granted_at, "
                            + "c.effective_at, c.withdrawal_effect, c.revoke_sessions, c.consent_id "
                            + "FROM iam_consent c JOIN iam_consent_current p ON p.consent_id = c.consent_id "
                            // Legacy rows created before V11 have no published document/policy
                            // digest. They stay in immutable history but are not a current
                            // authorization fact; treating them as absent lets the user submit
                            // a fresh server-published consent without fabricating a digest.
                            + "WHERE c.principal_id = ? AND c.consent_type = ? "
                            + "AND c.document_digest IS NOT NULL AND c.policy_digest IS NOT NULL LIMIT 1",
                    (ResultSet rs, int rowNum) -> map(rs), principalId.toString(), type.name())
                    .stream().findFirst();
            // V11's current projection is the only authorization read path. Do not fall back to
            // an unverified legacy history row when the projection is missing or stale.
            return current;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public Optional<ConsentRecord> findForUpdate(PrincipalId principalId, ConsentType type) {
        try {
            // Locking a deterministic key closes the first-write gap left by an absent history row.
            lockKey(principalId, type);
            return jdbc.query(
                    "SELECT c.principal_id, c.consent_type, c.purpose, c.required_scope, c.document_version, "
                            + "c.document_digest, c.policy_version, c.policy_digest, c.status, c.granted_at, "
                            + "c.effective_at, c.withdrawal_effect, c.revoke_sessions, c.consent_id "
                            + "FROM iam_consent c JOIN iam_consent_current p ON p.consent_id = c.consent_id "
                            + "WHERE c.principal_id = ? AND c.consent_type = ? "
                            + "AND c.document_digest IS NOT NULL AND c.policy_digest IS NOT NULL LIMIT 1 FOR UPDATE",
                    (ResultSet rs, int rowNum) -> map(rs), principalId.toString(), type.name())
                    .stream().findFirst();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public ConsentRecord appendIfCurrent(ConsentRecord record, ConsentRecord expected) {
        Optional<ConsentRecord> current = findForUpdate(record.principalId(), record.type());
        if (!Objects.equals(current.orElse(null), expected)) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.version_mismatch");
        }
        return append(record);
    }

    @Override
    public List<ConsentHistoryEntry> history(PrincipalId principalId, ConsentType type) {
        try {
            return jdbc.query(
                    "SELECT c.principal_id, c.consent_type, c.purpose, c.required_scope, c.document_version, "
                            + "c.document_digest, c.policy_version, c.policy_digest, c.status, c.granted_at, "
                            + "c.effective_at, c.withdrawal_effect, c.revoke_sessions, c.consent_id "
                            + "FROM iam_consent c WHERE c.principal_id = ? AND c.consent_type = ? "
                            + "ORDER BY c.effective_at ASC, c.granted_at ASC, c.consent_id ASC",
                    (ResultSet rs, int rowNum) -> mapHistory(rs), principalId.toString(), type.name());
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private void lockKey(PrincipalId principalId, ConsentType type) {
        jdbc.update(
                "INSERT INTO iam_consent_lock (principal_id, consent_type, lock_id) VALUES (?, ?, ?) "
                        + "ON DUPLICATE KEY UPDATE lock_id = lock_id",
                principalId.toString(), type.name(), ZERO_ID);
    }

    private static ConsentRecord map(ResultSet rs) throws java.sql.SQLException {
        ConsentHistoryEntry entry = mapHistory(rs);
        if (entry.legacy()) {
            // Legacy rows without a published digest cannot participate in authorization.
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.legacy_fact_revalidation_required");
        }
        return entry.verifiedRecord();
    }

    private static ConsentHistoryEntry mapHistory(ResultSet rs) throws java.sql.SQLException {
        PrincipalId principal = new PrincipalId(UUID.fromString(rs.getString("principal_id")));
        UUID consentId = UUID.fromString(rs.getString("consent_id"));
        ConsentType type = ConsentType.fromLegacyStorage(rs.getString("consent_type"));
        String purpose = rs.getString("purpose");
        String requirementScope = rs.getString("required_scope");
        String documentVersion = rs.getString("document_version");
        String policyVersion = rs.getString("policy_version");
        String documentDigest = rs.getString("document_digest");
        String policyDigest = rs.getString("policy_digest");
        Timestamp recordedAt = rs.getTimestamp("granted_at");
        Timestamp effectiveAt = rs.getTimestamp("effective_at");
        if (consentId == null || purpose == null || requirementScope == null || documentVersion == null
                || policyVersion == null || recordedAt == null || effectiveAt == null) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.legacy_fact_revalidation_required");
        }
        return new ConsentHistoryEntry(consentId, principal, TenantScope.derive(principal), type, purpose,
                requirementScope, "BASE_REQUIRED".equals(requirementScope) || "LEARNING_REQUIRED".equals(requirementScope),
                new ConsentVersion(documentVersion), documentDigest, new ConsentVersion(policyVersion), policyDigest,
                "GRANTED".equals(rs.getString("status")), recordedAt.toInstant(), effectiveAt.toInstant(),
                ConsentPolicyDescriptor.WithdrawalEffect.valueOf(rs.getString("withdrawal_effect")),
                rs.getBoolean("revoke_sessions"), documentDigest == null || policyDigest == null);
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
