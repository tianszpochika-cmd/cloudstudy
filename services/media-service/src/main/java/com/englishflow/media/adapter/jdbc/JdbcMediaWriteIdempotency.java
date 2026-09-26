package com.englishflow.media.adapter.jdbc;

import com.englishflow.media.application.MediaWriteFingerprint;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.port.MediaWriteIdempotencyPort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

/** MySQL owner receipt. The unique claim, aggregate, outbox and response commit together. */
public final class JdbcMediaWriteIdempotency implements MediaWriteIdempotencyPort {

    private static final TypeReference<Map<String, Object>> RESPONSE_TYPE = new TypeReference<>() {};
    private final JdbcTemplate jdbc;
    private final String table;
    private final TransactionTemplate transaction;
    private final ObjectMapper mapper;

    public JdbcMediaWriteIdempotency(JdbcTemplate jdbc, DataSource dataSource, String schema, ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        if (schema == null || !schema.matches("[A-Za-z0-9_]{1,64}")) {
            throw new IllegalArgumentException("schema is invalid");
        }
        this.table = "`" + schema + "`.`media_write_idempotency_record`";
        this.transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        this.mapper = Objects.requireNonNull(mapper, "mapper is required");
    }

    @Override
    public Map<String, Object> execute(
            String operation, String assetId, Object request,
            MediaAuthorizationContext context, String idempotencyKey,
            Runnable authorize, Supplier<Map<String, Object>> command) {
        String key = MediaWriteFingerprint.key(idempotencyKey);
        String fingerprint = MediaWriteFingerprint.digest(assetId, request);
        if (operation == null || !operation.matches("[a-z_]{3,64}")) {
            throw new IllegalArgumentException("operation is invalid");
        }
        Objects.requireNonNull(context, "context is required");
        Objects.requireNonNull(authorize, "authorize is required");
        Objects.requireNonNull(command, "command is required");
        return transaction.execute(status -> {
            // A duplicate insert waits for the first transaction; it can only observe a
            // committed receipt with its completed response, never a partial command.
            jdbc.update("INSERT INTO " + table + " (tenant_id, subject_id, operation_name, "
                            + "idempotency_key, request_fingerprint, response_json, created_at) "
                            + "VALUES (?, ?, ?, ?, ?, NULL, ?) "
                            + "ON DUPLICATE KEY UPDATE idempotency_key=idempotency_key",
                    context.tenantId(), context.subjectId(), operation, key, fingerprint,
                    Timestamp.from(Instant.now()));
            Receipt receipt = jdbc.queryForObject(
                    "SELECT request_fingerprint, response_json FROM " + table
                            + " WHERE tenant_id = ? AND subject_id = ? AND operation_name = ? "
                            + "AND idempotency_key = ? FOR UPDATE",
                    (rs, index) -> new Receipt(rs.getString(1), rs.getString(2)),
                    context.tenantId(), context.subjectId(), operation, key);
            if (receipt == null) throw new IllegalStateException("media receipt claim disappeared");
            if (!receipt.fingerprint().equals(fingerprint)) {
                throw MediaOperationException.conflict(
                        "MEDIA_IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used for another media request");
            }
            if (!operation.equals("register")) {
                jdbc.queryForList("SELECT asset_id FROM media_asset WHERE asset_id = ? FOR UPDATE", assetId);
            }
            authorize.run();
            if (receipt.responseJson() != null) return parse(receipt.responseJson());
            Map<String, Object> response = Objects.requireNonNull(command.get(), "command response is required");
            jdbc.update("UPDATE " + table + " SET response_json = ? WHERE tenant_id = ? "
                            + "AND subject_id = ? AND operation_name = ? AND idempotency_key = ?",
                    write(response), context.tenantId(), context.subjectId(), operation, key);
            return response;
        });
    }

    private String write(Map<String, Object> response) {
        try {
            return mapper.writeValueAsString(response);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("media response could not be recorded", exception);
        }
    }

    private Map<String, Object> parse(String body) {
        try {
            return mapper.readValue(body, RESPONSE_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("recorded media response is invalid", exception);
        }
    }

    private record Receipt(String fingerprint, String responseJson) {}
}
