package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Durable IAM device projection owned by the IAM schema. */
public final class JdbcDeviceRegistry implements DeviceRegistryPort {

    private final JdbcTemplate jdbc;

    public JdbcDeviceRegistry(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public DeviceRegistration save(DeviceRegistration registration) {
        try {
            jdbc.update(
                    "INSERT INTO iam_device (device_id, principal_id, device_public_id, device_id_hash, "
                            + "device_type, status, last_seen_at, revoked_at, revoke_reason, created_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                            + "ON DUPLICATE KEY UPDATE principal_id = VALUES(principal_id), "
                            + "device_type = VALUES(device_type), status = VALUES(status), "
                            + "last_seen_at = VALUES(last_seen_at), revoked_at = VALUES(revoked_at), "
                            + "revoke_reason = VALUES(revoke_reason)",
                    registration.deviceId().value(), registration.principalId().toString(),
                    registration.deviceId().value(), digest(registration.deviceId().value()),
                    registration.platform(), registration.active() ? "ACTIVE" : "REVOKED",
                    Timestamp.from(registration.registeredAt()),
                    registration.revokedAt() == null ? null : Timestamp.from(registration.revokedAt()),
                    registration.revokedAt() == null ? null : "device_revoked",
                    Timestamp.from(registration.registeredAt()));
            return registration;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<DeviceRegistration> find(PrincipalId principalId, DeviceId deviceId) {
        return query("SELECT device_id, principal_id, device_type, status, last_seen_at, revoked_at "
                + "FROM iam_device WHERE principal_id = ? AND device_id = ?", principalId, deviceId);
    }

    @Override
    public List<DeviceRegistration> findByPrincipal(PrincipalId principalId) {
        try {
            return jdbc.query(
                    "SELECT device_id, principal_id, device_type, status, last_seen_at, revoked_at "
                            + "FROM iam_device WHERE principal_id = ? ORDER BY last_seen_at DESC",
                    (ResultSet rs, int rowNum) -> map(rs), principalId.toString());
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    @Override
    public List<DeviceRegistration> history(PrincipalId principalId, DeviceId deviceId) {
        return find(principalId, deviceId).stream().toList();
    }

    @Override
    public Optional<DeviceRegistration> revoke(PrincipalId principalId, DeviceId deviceId, Instant at) {
        try {
            jdbc.update("UPDATE iam_device SET status = 'REVOKED', revoked_at = ?, revoke_reason = ? "
                            + "WHERE principal_id = ? AND device_id = ?",
                    Timestamp.from(at), "device_kicked", principalId.toString(), deviceId.value());
            return find(principalId, deviceId);
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private Optional<DeviceRegistration> query(String sql, PrincipalId principalId, DeviceId deviceId) {
        try {
            return jdbc.query(sql, (ResultSet rs, int rowNum) -> map(rs),
                    principalId.toString(), deviceId.value()).stream().findFirst();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private static DeviceRegistration map(ResultSet rs) throws java.sql.SQLException {
        PrincipalId principal = new PrincipalId(java.util.UUID.fromString(rs.getString("principal_id")));
        Timestamp revoked = rs.getTimestamp("revoked_at");
        return new DeviceRegistration(
                new DeviceId(rs.getString("device_id")), principal, TenantScope.derive(principal),
                rs.getString("device_type"), "browser", rs.getTimestamp("last_seen_at").toInstant(),
                revoked == null ? null : revoked.toInstant());
    }

    private static byte[] digest(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
