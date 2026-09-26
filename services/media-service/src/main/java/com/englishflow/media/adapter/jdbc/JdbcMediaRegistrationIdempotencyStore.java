package com.englishflow.media.adapter.jdbc;

import com.englishflow.media.port.MediaRegistrationIdempotencyPort;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Objects;
import java.util.Optional;

/**
 * M3-004: durable registration idempotency. The domain fingerprint is an
 * unbounded draft rendering, so only its SHA-256 hex enters the CHAR(64)
 * column; the asset id rides alongside for idempotent replay.
 */
public final class JdbcMediaRegistrationIdempotencyStore implements MediaRegistrationIdempotencyPort {

    private final JdbcTemplate jdbc;
    private final String schema;

    public JdbcMediaRegistrationIdempotencyStore(JdbcTemplate jdbc, String schema) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        if (schema == null || !schema.matches("[A-Za-z0-9_]{1,64}")) {
            throw new IllegalArgumentException("schema is invalid");
        }
        this.schema = schema;
    }

    @Override
    public Optional<RegistrationReceipt> find(String tenantId, String subjectId, String idempotencyKey) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT request_fingerprint, asset_id FROM `" + schema + "`.`media_idempotency_record` "
                            + "WHERE tenant_id = ? AND subject_id = ? AND idempotency_key = ?",
                    (rs, row) -> new RegistrationReceipt(rs.getString(1), rs.getString(2)),
                    tenantId, subjectId, idempotencyKey));
        } catch (EmptyResultDataAccessException missing) {
            return Optional.empty();
        }
    }

    @Override
    public void save(String tenantId, String subjectId, String idempotencyKey, RegistrationReceipt receipt) {
        Objects.requireNonNull(receipt, "receipt is required");
        jdbc.update("INSERT INTO `" + schema + "`.`media_idempotency_record` "
                        + "(tenant_id, subject_id, idempotency_key, request_fingerprint, asset_id, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(6))",
                tenantId, subjectId, idempotencyKey, receipt.fingerprint(), receipt.assetId());
    }
}
