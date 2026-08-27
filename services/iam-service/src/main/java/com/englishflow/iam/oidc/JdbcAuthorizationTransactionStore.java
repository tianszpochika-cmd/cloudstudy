package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.net.URI;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/** Durable, expiring and one-time OIDC state/nonce/PKCE transaction adapter. */
public final class JdbcAuthorizationTransactionStore implements AuthorizationTransactionPort {

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public JdbcAuthorizationTransactionStore(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Override
    public Optional<AuthorizationTransaction> find(String state) {
        requireState(state);
        try {
            return jdbc.query(
                    "SELECT provider_id, client_id, redirect_uri, state, nonce, code_verifier, "
                            + "code_challenge, created_at, expires_at FROM iam_oidc_authorization_transaction "
                            + "WHERE state = ? AND consumed_at IS NULL AND expires_at > ?",
                    (ResultSet rs, int rowNum) -> map(rs),
                    state,
                    Timestamp.from(Instant.now(clock))).stream().findFirst();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    public void save(AuthorizationTransaction transaction) {
        Objects.requireNonNull(transaction, "transaction");
        try {
            jdbc.update(
                    "INSERT INTO iam_oidc_authorization_transaction "
                            + "(provider_id, client_id, redirect_uri, state, nonce, code_verifier, "
                            + "code_challenge, created_at, expires_at, consumed_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
                    transaction.providerId(),
                    transaction.clientId(),
                    transaction.redirectUri().toString(),
                    transaction.state(),
                    transaction.nonce(),
                    transaction.codeVerifier(),
                    transaction.codeChallenge(),
                    Timestamp.from(transaction.createdAt()),
                    Timestamp.from(transaction.expiresAt()));
        } catch (DuplicateKeyException exception) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED,
                    "iam.oidc.state_collision");
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<AuthorizationTransaction> consume(String state) {
        requireState(state);
        try {
            int updated = jdbc.update(
                    "UPDATE iam_oidc_authorization_transaction SET consumed_at = ? "
                            + "WHERE state = ? AND consumed_at IS NULL AND expires_at > ?",
                    Timestamp.from(Instant.now(clock)),
                    state,
                    Timestamp.from(Instant.now(clock)));
            return updated == 1 ? findConsumed(state) : Optional.empty();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    public boolean wasConsumed(String state) {
        requireState(state);
        try {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM iam_oidc_authorization_transaction "
                            + "WHERE state = ? AND consumed_at IS NOT NULL",
                    Integer.class,
                    state);
            return count != null && count > 0;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private Optional<AuthorizationTransaction> findConsumed(String state) {
        return jdbc.query(
                "SELECT provider_id, client_id, redirect_uri, state, nonce, code_verifier, "
                        + "code_challenge, created_at, expires_at FROM iam_oidc_authorization_transaction "
                        + "WHERE state = ?",
                (ResultSet rs, int rowNum) -> map(rs), state).stream().findFirst();
    }

    private static AuthorizationTransaction map(ResultSet rs) throws java.sql.SQLException {
        return new AuthorizationTransaction(
                rs.getString("provider_id"),
                rs.getString("client_id"),
                URI.create(rs.getString("redirect_uri")),
                rs.getString("state"),
                rs.getString("nonce"),
                rs.getString("code_verifier"),
                rs.getString("code_challenge"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("expires_at").toInstant());
    }

    private static void requireState(String state) {
        if (state == null || state.isBlank() || state.length() > 256) {
            throw new IamPolicyException(IamDecisionCode.OIDC_STATE_INVALID, "iam.oidc.state_invalid");
        }
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(
                IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
