package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * JDBC session/revocation adapter. It stores only the refresh-token digest and uses a conditional
 * update for rotation so replay detection also works across JVMs.
 */
public final class JdbcSessionStore implements SessionStore {

    private final JdbcTemplate jdbc;
    private final Duration sessionTtl;

    public JdbcSessionStore(JdbcTemplate jdbc, Duration sessionTtl) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        if (sessionTtl == null || sessionTtl.isNegative() || sessionTtl.isZero()) {
            throw new IllegalArgumentException("sessionTtl must be positive");
        }
        this.sessionTtl = sessionTtl;
    }

    @Override
    public SessionRecord save(SessionRecord session) {
        Objects.requireNonNull(session, "session");
        try {
            jdbc.update(
                    "INSERT INTO iam_session "
                            + "(session_id, principal_id, device_id, token_family_id, refresh_token_hash, "
                            + "status, issued_at, expires_at, rotated_at, revoked_at, revoke_reason, "
                            + "provider_issuer, provider_client_id, provider_session_reference, rotation) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    session.sessionId().toString(),
                    session.principalId().toString(),
                    databaseDeviceId(session.deviceId()),
                    session.sessionId().toString(),
                    digestBytes(session.refreshTokenDigest()),
                    status(session.status()),
                    timestamp(session.createdAt()),
                    timestamp(session.createdAt().plus(sessionTtl)),
                    session.rotation() == 0 ? null : timestamp(session.updatedAt()),
                    session.revokedAt() == null ? null : timestamp(session.revokedAt()),
                    session.revocationReason(),
                    session.providerIssuer().toString(),
                    session.providerClientId(),
                    session.providerSessionReference().value(),
                    session.rotation());
            return session;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    public Optional<SessionRecord> find(SessionId sessionId) {
        Objects.requireNonNull(sessionId, "sessionId");
        try {
            return jdbc.query(
                    "SELECT session_id, principal_id, device_id, provider_issuer, provider_client_id, "
                            + "provider_session_reference, refresh_token_hash, rotation, status, "
                            + "issued_at, rotated_at, revoked_at, revoke_reason "
                            + "FROM iam_session WHERE session_id = ?",
                    (ResultSet rs, int rowNum) -> map(rs),
                    sessionId.toString()).stream().findFirst();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    public Optional<SessionRecord> findByRefreshTokenDigest(String refreshTokenDigest) {
        Objects.requireNonNull(refreshTokenDigest, "refreshTokenDigest");
        try {
            return jdbc.query(
                    "SELECT session_id, principal_id, device_id, provider_issuer, provider_client_id, "
                            + "provider_session_reference, refresh_token_hash, rotation, status, "
                            + "issued_at, rotated_at, revoked_at, revoke_reason FROM iam_session "
                            + "WHERE refresh_token_hash = ?",
                    (ResultSet rs, int rowNum) -> map(rs),
                    digestBytes(refreshTokenDigest)).stream().findFirst();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    public SessionRecord replace(SessionRecord session) {
        Objects.requireNonNull(session, "session");
        try {
            int updated = jdbc.update(
                    "UPDATE iam_session SET refresh_token_hash = ?, rotation = ?, status = ?, "
                            + "rotated_at = ?, revoked_at = ?, revoke_reason = ?, provider_issuer = ?, "
                            + "provider_client_id = ?, provider_session_reference = ? WHERE session_id = ?",
                    digestBytes(session.refreshTokenDigest()),
                    session.rotation(),
                    status(session.status()),
                    session.rotation() == 0 ? null : timestamp(session.updatedAt()),
                    session.revokedAt() == null ? null : timestamp(session.revokedAt()),
                    session.revocationReason(),
                    session.providerIssuer().toString(),
                    session.providerClientId(),
                    session.providerSessionReference().value(),
                    session.sessionId().toString());
            if (updated != 1) {
                throw unavailable(null);
            }
            return session;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    public Optional<SessionRecord> replaceIfCurrent(
            SessionId sessionId,
            long expectedRotation,
            String expectedRefreshTokenDigest,
            SessionRecord replacement) {
        Objects.requireNonNull(sessionId, "sessionId");
        Objects.requireNonNull(expectedRefreshTokenDigest, "expectedRefreshTokenDigest");
        Objects.requireNonNull(replacement, "replacement");
        try {
            int updated = jdbc.update(
                    "UPDATE iam_session SET refresh_token_hash = ?, rotation = ?, status = ?, "
                            + "rotated_at = ?, revoked_at = ?, revoke_reason = ?, provider_issuer = ?, "
                            + "provider_client_id = ?, provider_session_reference = ? "
                            + "WHERE session_id = ? AND rotation = ? AND refresh_token_hash = ? AND status = 'ACTIVE'",
                    digestBytes(replacement.refreshTokenDigest()),
                    replacement.rotation(),
                    status(replacement.status()),
                    timestamp(replacement.updatedAt()),
                    replacement.revokedAt() == null ? null : timestamp(replacement.revokedAt()),
                    replacement.revocationReason(),
                    replacement.providerIssuer().toString(),
                    replacement.providerClientId(),
                    replacement.providerSessionReference().value(),
                    sessionId.toString(),
                    expectedRotation,
                    digestBytes(expectedRefreshTokenDigest));
            return updated == 1 ? Optional.of(replacement) : Optional.empty();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    public Optional<SessionRecord> revoke(SessionId sessionId, Instant at, String reason) {
        Objects.requireNonNull(sessionId, "sessionId");
        Objects.requireNonNull(at, "at");
        Objects.requireNonNull(reason, "reason");
        try {
            jdbc.update(
                    "UPDATE iam_session SET status = 'REVOKED', revoked_at = ?, revoke_reason = ? "
                            + "WHERE session_id = ? AND status <> 'REVOKED'",
                    timestamp(at), reason, sessionId.toString());
            return find(sessionId);
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    public List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId) {
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(deviceId, "deviceId");
        try {
            return jdbc.query(
                    "SELECT session_id, principal_id, device_id, provider_issuer, provider_client_id, "
                            + "provider_session_reference, refresh_token_hash, rotation, status, "
                            + "issued_at, rotated_at, revoked_at, revoke_reason FROM iam_session "
                            + "WHERE principal_id = ? AND device_id = ?",
                    (ResultSet rs, int rowNum) -> map(rs),
                    principalId.toString(), databaseDeviceId(deviceId));
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    private static SessionRecord map(ResultSet rs) throws java.sql.SQLException {
        PrincipalId principal = new PrincipalId(UUID.fromString(rs.getString("principal_id")));
        String device = rs.getString("device_id");
        Instant issuedAt = rs.getTimestamp("issued_at").toInstant();
        Timestamp rotatedAt = rs.getTimestamp("rotated_at");
        Timestamp revokedAt = rs.getTimestamp("revoked_at");
        return new SessionRecord(
                new SessionId(UUID.fromString(rs.getString("session_id"))),
                principal,
                TenantScope.derive(principal),
                new DeviceId(device),
                URI.create(rs.getString("provider_issuer")),
                rs.getString("provider_client_id"),
                new ProviderSessionReference(rs.getString("provider_session_reference")),
                bytesToHex(rs.getBytes("refresh_token_hash")),
                rs.getLong("rotation"),
                SessionStatus.valueOf(rs.getString("status")) == SessionStatus.ACTIVE
                        ? SessionStatus.ACTIVE : SessionStatus.REVOKED,
                issuedAt,
                rotatedAt == null ? issuedAt : rotatedAt.toInstant(),
                revokedAt == null ? null : revokedAt.toInstant(),
                rs.getString("revoke_reason"));
    }

    private static String databaseDeviceId(DeviceId deviceId) {
        try {
            return UUID.fromString(deviceId.value()).toString();
        } catch (IllegalArgumentException exception) {
            throw new IamPolicyException(
                    IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                    "iam.persistence.device_id_invalid");
        }
    }

    private static byte[] digestBytes(String digest) {
        if (digest == null || !digest.matches("[0-9a-fA-F]{64}")) {
            throw new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                    "iam.persistence.digest_invalid");
        }
        return java.util.HexFormat.of().parseHex(digest);
    }

    private static String bytesToHex(byte[] bytes) {
        if (bytes == null || bytes.length != 32) {
            throw new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                    "iam.persistence.digest_invalid");
        }
        return java.util.HexFormat.of().formatHex(bytes);
    }

    private static String status(SessionStatus status) {
        return status == SessionStatus.ACTIVE ? "ACTIVE" : "REVOKED";
    }

    private static Timestamp timestamp(Instant instant) {
        return Timestamp.from(instant);
    }

    private static IamPolicyException unavailable(Exception exception) {
        return new IamPolicyException(
                IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
