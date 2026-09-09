package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Objects;
import java.util.Optional;

/** MySQL idempotency claim store. The unique key and conditional update are the cross-process CAS. */
public class JdbcIdempotencyStore implements IdempotencyStore {
    private final JdbcTemplate jdbc;

    public JdbcIdempotencyStore(JdbcTemplate jdbc) { this.jdbc = Objects.requireNonNull(jdbc, "jdbc"); }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public IdempotencyRecord claim(String scope, String key, String requestHash) {
        try {
            IdempotencyRequestFingerprint.StoredFingerprint fingerprint =
                    IdempotencyRequestFingerprint.parseCurrent(requestHash);
            jdbc.update("INSERT INTO iam_idempotency_record "
                            + "(scope_key, idempotency_key, request_fingerprint, request_fingerprint_version, state, created_at) "
                            + "VALUES (?, ?, ?, ?, 'IN_PROGRESS', CURRENT_TIMESTAMP(6))",
                    scope, key, fingerprint.digest(), fingerprint.version());
            return find(scope, key).orElseThrow(JdbcIdempotencyStore::unavailable);
        } catch (DuplicateKeyException duplicate) {
            IdempotencyRecord existing = find(scope, key).orElseThrow(JdbcIdempotencyStore::unavailable);
            verifyHash(existing, requestHash);
            if (existing.state() == IdempotencyRecord.State.IN_PROGRESS) throw inProgress();
            return existing;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public IdempotencyRecord complete(String scope, String key, String requestHash,
                                      int responseStatus, String resultReference) {
        return complete(scope, key, requestHash, responseStatus, resultReference, null);
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public IdempotencyRecord complete(String scope, String key, String requestHash,
                                      int responseStatus, String resultReference,
                                      IdempotencyRecord.ResponseSnapshot snapshot) {
        try {
            IdempotencyRequestFingerprint.StoredFingerprint fingerprint =
                    IdempotencyRequestFingerprint.parseCurrent(requestHash);
            int updated = jdbc.update("UPDATE iam_idempotency_record SET state = 'COMPLETED', "
                            + "response_status = ?, result_reference = ?, replay_ciphertext = ?, "
                            + "replay_nonce = ?, replay_key_version = ?, error_code = NULL, "
                            + "error_message_key = NULL, completed_at = CURRENT_TIMESTAMP(6) "
                            + "WHERE scope_key = ? AND idempotency_key = ? AND request_fingerprint = ? "
                            + "AND request_fingerprint_version = ? AND state = 'IN_PROGRESS'",
                    responseStatus, resultReference,
                    snapshot == null ? null : Base64.getDecoder().decode(snapshot.ciphertext()),
                    snapshot == null ? null : Base64.getDecoder().decode(snapshot.nonce()),
                    snapshot == null ? null : snapshot.keyVersion(), scope, key,
                    fingerprint.digest(), fingerprint.version());
            IdempotencyRecord existing = find(scope, key).orElseThrow(JdbcIdempotencyStore::unavailable);
            if (updated != 1) {
                verifyHash(existing, requestHash);
                if (existing.state() == IdempotencyRecord.State.IN_PROGRESS) throw inProgress();
            }
            return existing;
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public IdempotencyRecord reject(String scope, String key, String requestHash,
                                    IamPolicyException exception) {
        return reject(scope, key, requestHash, exception, 400);
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public IdempotencyRecord reject(String scope, String key, String requestHash,
                                    IamPolicyException exception, int responseStatus) {
        Objects.requireNonNull(exception, "exception");
        try {
            IdempotencyRequestFingerprint.StoredFingerprint fingerprint =
                    IdempotencyRequestFingerprint.parseCurrent(requestHash);
            int updated = jdbc.update("UPDATE iam_idempotency_record SET state = 'REJECTED', "
                            + "response_status = ?, result_reference = NULL, replay_ciphertext = NULL, "
                            + "replay_nonce = NULL, replay_key_version = NULL, error_code = ?, "
                            + "error_message_key = ?, completed_at = CURRENT_TIMESTAMP(6) "
                            + "WHERE scope_key = ? AND idempotency_key = ? AND request_fingerprint = ? "
                            + "AND request_fingerprint_version = ? AND state = 'IN_PROGRESS'",
                    responseStatus, exception.code().name(), exception.messageKey(), scope, key,
                    fingerprint.digest(), fingerprint.version());
            IdempotencyRecord existing = find(scope, key).orElseThrow(JdbcIdempotencyStore::unavailable);
            if (updated != 1) {
                verifyHash(existing, requestHash);
                if (existing.state() == IdempotencyRecord.State.IN_PROGRESS) throw inProgress();
            }
            return existing;
        } catch (IamPolicyException policyException) {
            throw policyException;
        } catch (DataAccessException | IllegalArgumentException dataException) {
            throw unavailable();
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public void abandon(String scope, String key, String requestHash) {
        try {
            IdempotencyRequestFingerprint.StoredFingerprint fingerprint =
                    IdempotencyRequestFingerprint.parseCurrent(requestHash);
            jdbc.update("DELETE FROM iam_idempotency_record WHERE scope_key = ? AND idempotency_key = ? "
                            + "AND request_fingerprint = ? AND request_fingerprint_version = ? "
                            + "AND state = 'IN_PROGRESS'",
                    scope, key, fingerprint.digest(), fingerprint.version());
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public void purgeExpired(Instant now, Duration retention) {
        if (now == null || retention == null || retention.isNegative() || retention.isZero()) return;
        try {
            jdbc.update("DELETE FROM iam_idempotency_record WHERE created_at < ?",
                    Timestamp.from(now.minus(retention)));
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private Optional<IdempotencyRecord> find(String scope, String key) {
        try {
            return jdbc.query("SELECT scope_key, idempotency_key, request_fingerprint, request_fingerprint_version, "
                            + "state, response_status, "
                            + "result_reference, created_at, completed_at, replay_ciphertext, "
                            + "replay_nonce, replay_key_version, error_code, error_message_key "
                            + "FROM iam_idempotency_record WHERE scope_key = ? AND idempotency_key = ?",
                    (ResultSet rs, int rowNum) -> map(rs), scope, key).stream().findFirst();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private static IdempotencyRecord map(ResultSet rs) throws java.sql.SQLException {
        Timestamp completedAt = rs.getTimestamp("completed_at");
        byte[] ciphertext = rs.getBytes("replay_ciphertext");
        byte[] nonce = rs.getBytes("replay_nonce");
        return new IdempotencyRecord(rs.getString("scope_key"), rs.getString("idempotency_key"),
                IdempotencyRequestFingerprint.fromStored(rs.getString("request_fingerprint_version"),
                        rs.getBytes("request_fingerprint")),
                IdempotencyRecord.State.valueOf(rs.getString("state")),
                (Integer) rs.getObject("response_status"), rs.getString("result_reference"),
                rs.getTimestamp("created_at").toInstant(),
                completedAt == null ? null : completedAt.toInstant(),
                ciphertext == null ? null : Base64.getEncoder().encodeToString(ciphertext),
                nonce == null ? null : Base64.getEncoder().encodeToString(nonce),
                rs.getString("replay_key_version"), rs.getString("error_code"),
                rs.getString("error_message_key"));
    }

    private static void verifyHash(IdempotencyRecord existing, String requestHash) {
        if (!IdempotencyRequestFingerprint.matchesCurrent(existing.requestHash(), requestHash)) {
            throw new IamPolicyException(IamDecisionCode.IDEMPOTENCY_KEY_REUSED,
                    "iam.idempotency.key_reused");
        }
    }

    private static IamPolicyException inProgress() {
        return new IamPolicyException(IamDecisionCode.IDEMPOTENCY_IN_PROGRESS,
                "iam.idempotency.in_progress");
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
