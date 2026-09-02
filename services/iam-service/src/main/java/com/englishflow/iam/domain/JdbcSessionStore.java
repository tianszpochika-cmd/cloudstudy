package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Durable refresh-session adapter with a conditional rotation update and digest history. */
public class JdbcSessionStore implements SessionStore {
    private final JdbcTemplate jdbc;

    public JdbcSessionStore(JdbcTemplate jdbc) { this.jdbc = Objects.requireNonNull(jdbc, "jdbc"); }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public SessionRecord save(SessionRecord session) {
        try {
            jdbc.update("INSERT INTO iam_session (session_id, principal_id, device_id, token_family_id, refresh_token_hash, "
                            + "status, issued_at, expires_at, rotated_at, revoked_at, revoke_reason, rotation) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    session.sessionId().toString(), session.principalId().toString(), databaseDeviceId(session.deviceId()),
                    session.tokenFamilyId(), digestBytes(session.refreshTokenDigest()), status(session.status()),
                    timestamp(session.createdAt()), timestamp(session.expiresAt()), null, null, null, session.rotation());
            return session;
        } catch (DataAccessException | IllegalArgumentException exception) { throw unavailable(); }
    }

    @Override public Optional<SessionRecord> find(SessionId id) { return query("WHERE s.session_id = ?", id.toString()); }

    @Override
    public Optional<SessionRecord> findByRefreshTokenDigest(String digest) {
        Objects.requireNonNull(digest, "digest");
        try {
            return jdbc.query(baseSelect() + " LEFT JOIN iam_refresh_token_history h ON h.session_id = s.session_id "
                            + "WHERE s.refresh_token_hash = ? OR h.refresh_token_hash = ? ORDER BY h.rotation DESC",
                    (ResultSet rs, int rowNum) -> map(rs), digestBytes(digest), digestBytes(digest)).stream().findFirst();
        } catch (DataAccessException | IllegalArgumentException exception) { throw unavailable(); }
    }

    @Override
    public SessionRecord replace(SessionRecord session) {
        try {
            int updated = updateCurrent(session, session.sessionId().toString());
            if (updated != 1) throw unavailable();
            return session;
        } catch (DataAccessException | IllegalArgumentException exception) { throw unavailable(); }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public Optional<SessionRecord> replaceIfCurrent(SessionId id, long expectedRotation,
                                                    String expectedDigest, SessionRecord replacement) {
        try {
            int updated = jdbc.update("UPDATE iam_session SET refresh_token_hash = ?, rotation = ?, status = ?, "
                            + "rotated_at = ?, expires_at = ?, revoked_at = ?, revoke_reason = ? "
                            + "WHERE session_id = ? AND rotation = ? AND refresh_token_hash = ? AND status = 'ACTIVE'",
                    digestBytes(replacement.refreshTokenDigest()), replacement.rotation(), status(replacement.status()),
                    timestamp(replacement.updatedAt()), timestamp(replacement.expiresAt()), null, null,
                    id.toString(), expectedRotation, digestBytes(expectedDigest));
            if (updated != 1) return Optional.empty();
            jdbc.update("INSERT INTO iam_refresh_token_history (session_id, token_family_id, refresh_token_hash, rotation, created_at) "
                            + "VALUES (?, ?, ?, ?, ?)", id.toString(), replacement.tokenFamilyId(), digestBytes(expectedDigest),
                    expectedRotation, timestamp(replacement.updatedAt()));
            return Optional.of(replacement);
        } catch (DataAccessException | IllegalArgumentException exception) { throw unavailable(); }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public Optional<SessionRecord> revoke(SessionId id, Instant at, String reason) {
        try {
            jdbc.update("UPDATE iam_session SET status = 'REVOKED', revoked_at = ?, revoke_reason = ? "
                            + "WHERE session_id = ? AND status <> 'REVOKED'", timestamp(at), reason, id.toString());
            return find(id);
        } catch (DataAccessException | IllegalArgumentException exception) { throw unavailable(); }
    }

    @Override public List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId) {
        return queryList("WHERE s.principal_id = ? AND s.device_id = ?", principalId.toString(), databaseDeviceId(deviceId));
    }

    @Override public List<SessionRecord> findByPrincipal(PrincipalId principalId) {
        return queryList("WHERE s.principal_id = ?", principalId.toString());
    }

    private Optional<SessionRecord> query(String suffix, Object... args) {
        try { return jdbc.query(baseSelect() + " " + suffix, (ResultSet rs, int rowNum) -> map(rs), args).stream().findFirst(); }
        catch (DataAccessException | IllegalArgumentException exception) { throw unavailable(); }
    }

    private List<SessionRecord> queryList(String suffix, Object... args) {
        try { return jdbc.query(baseSelect() + " " + suffix, (ResultSet rs, int rowNum) -> map(rs), args); }
        catch (DataAccessException | IllegalArgumentException exception) { throw unavailable(); }
    }

    private int updateCurrent(SessionRecord session, String sessionId) {
        return jdbc.update("UPDATE iam_session SET refresh_token_hash = ?, rotation = ?, status = ?, rotated_at = ?, "
                        + "expires_at = ?, revoked_at = ?, revoke_reason = ? WHERE session_id = ?",
                digestBytes(session.refreshTokenDigest()), session.rotation(), status(session.status()),
                session.rotation() == 0 ? null : timestamp(session.updatedAt()), timestamp(session.expiresAt()),
                session.revokedAt() == null ? null : timestamp(session.revokedAt()), session.revocationReason(), sessionId);
    }

    private static String baseSelect() {
        return "SELECT s.session_id, s.principal_id, s.device_id, s.token_family_id, s.refresh_token_hash, "
                + "s.rotation, s.status, s.issued_at, s.rotated_at, s.expires_at, s.revoked_at, s.revoke_reason "
                + "FROM iam_session s";
    }

    private static SessionRecord map(ResultSet rs) throws java.sql.SQLException {
        PrincipalId principal = new PrincipalId(UUID.fromString(rs.getString("principal_id")));
        Timestamp rotated = rs.getTimestamp("rotated_at");
        Timestamp revoked = rs.getTimestamp("revoked_at");
        return new SessionRecord(new SessionId(UUID.fromString(rs.getString("session_id"))), principal,
                TenantScope.derive(principal), new DeviceId(rs.getString("device_id")), rs.getString("token_family_id"),
                bytesToHex(rs.getBytes("refresh_token_hash")), rs.getLong("rotation"),
                "ACTIVE".equals(rs.getString("status")) ? SessionStatus.ACTIVE : SessionStatus.REVOKED,
                rs.getTimestamp("issued_at").toInstant(), rotated == null ? rs.getTimestamp("issued_at").toInstant() : rotated.toInstant(),
                rs.getTimestamp("expires_at").toInstant(), revoked == null ? null : revoked.toInstant(), rs.getString("revoke_reason"));
    }

    private static String databaseDeviceId(DeviceId deviceId) {
        try { return UUID.fromString(deviceId.value()).toString(); }
        catch (IllegalArgumentException exception) { throw new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE, "iam.persistence.device_id_invalid"); }
    }
    private static byte[] digestBytes(String digest) { if (digest == null || !digest.matches("[0-9a-fA-F]{64}")) throw new IllegalArgumentException("digest"); return java.util.HexFormat.of().parseHex(digest); }
    private static String bytesToHex(byte[] bytes) { if (bytes == null || bytes.length != 32) throw new IllegalArgumentException("digest"); return java.util.HexFormat.of().formatHex(bytes); }
    private static String status(SessionStatus status) { return status == SessionStatus.ACTIVE ? "ACTIVE" : "REVOKED"; }
    private static Timestamp timestamp(Instant instant) { return instant == null ? null : Timestamp.from(instant); }
    private static IamPolicyException unavailable() { return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE, "iam.persistence.unavailable"); }
}
