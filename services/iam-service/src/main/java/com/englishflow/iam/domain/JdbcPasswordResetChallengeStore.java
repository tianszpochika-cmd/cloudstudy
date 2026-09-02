package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Durable one-time password-reset challenge store.
 *
 * <p>The raw reset credential never crosses this boundary. The database keeps only its SHA-256
 * digest and consumes a challenge with a conditional update so two IAM processes cannot both
 * redeem the same challenge.</p>
 */
public class JdbcPasswordResetChallengeStore implements PasswordResetChallengeStore {

    private final JdbcTemplate jdbc;

    public JdbcPasswordResetChallengeStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public PasswordResetChallenge save(PasswordResetChallenge challenge) {
        Objects.requireNonNull(challenge, "challenge");
        try {
            jdbc.update("INSERT INTO iam_password_reset_challenge "
                            + "(challenge_id, principal_id, token_digest, created_at, expires_at, consumed_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?)",
                    challenge.challengeId(), challenge.principalId().toString(), digestBytes(challenge.tokenDigest()),
                    Timestamp.from(challenge.createdAt()), Timestamp.from(challenge.expiresAt()),
                    challenge.consumed() ? Timestamp.from(challenge.createdAt()) : null);
            return challenge;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<PasswordResetChallenge> findByTokenDigest(String tokenDigest) {
        try {
            return jdbc.query("SELECT challenge_id, principal_id, token_digest, created_at, expires_at, consumed_at "
                            + "FROM iam_password_reset_challenge WHERE token_digest = ?",
                    (ResultSet rs, int rowNum) -> map(rs), digestBytes(tokenDigest)).stream().findFirst();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public PasswordResetChallenge consume(String challengeId) {
        Objects.requireNonNull(challengeId, "challengeId");
        try {
            int updated = jdbc.update("UPDATE iam_password_reset_challenge SET consumed_at = CURRENT_TIMESTAMP(6) "
                            + "WHERE challenge_id = ? AND consumed_at IS NULL "
                            + "AND expires_at > CURRENT_TIMESTAMP(6)", challengeId);
            if (updated != 1) {
                throw new IamPolicyException(IamDecisionCode.PASSWORD_RESET_INVALID,
                        "iam.password_reset.invalid");
            }
            return jdbc.query("SELECT challenge_id, principal_id, token_digest, created_at, expires_at, consumed_at "
                            + "FROM iam_password_reset_challenge WHERE challenge_id = ?",
                    (ResultSet rs, int rowNum) -> map(rs), challengeId).stream().findFirst()
                    .orElseThrow(() -> new IamPolicyException(IamDecisionCode.PASSWORD_RESET_INVALID,
                            "iam.password_reset.invalid"));
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private static PasswordResetChallenge map(ResultSet rs) throws java.sql.SQLException {
        Timestamp consumedAt = rs.getTimestamp("consumed_at");
        return new PasswordResetChallenge(
                rs.getString("challenge_id"),
                new PrincipalId(java.util.UUID.fromString(rs.getString("principal_id"))),
                bytesToHex(rs.getBytes("token_digest")),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("expires_at").toInstant(),
                consumedAt != null);
    }

    private static byte[] digestBytes(String digest) {
        if (digest == null || !digest.matches("[0-9a-fA-F]{64}")) throw new IllegalArgumentException("digest");
        return java.util.HexFormat.of().parseHex(digest);
    }

    private static String bytesToHex(byte[] bytes) {
        if (bytes == null || bytes.length != 32) throw new IllegalArgumentException("digest");
        return java.util.HexFormat.of().formatHex(bytes);
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
