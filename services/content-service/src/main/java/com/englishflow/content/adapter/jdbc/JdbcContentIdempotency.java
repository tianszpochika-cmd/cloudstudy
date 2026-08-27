package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.port.ContentIdempotencyPort;

import java.time.Clock;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

/**
 * Content-owned idempotency reservation and response replay seam.
 *
 * <p>The database owns uniqueness and the transaction. The small process-local result map only
 * replays a response whose durable fact was committed in this JVM; an old row without a response
 * object is rejected rather than executing the command a second time.</p>
 */
public final class JdbcContentIdempotency implements ContentIdempotencyPort {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final Map<String, Object> results = new ConcurrentHashMap<>();

    public JdbcContentIdempotency(
            JdbcTemplate jdbc,
            TransactionTemplate transaction,
            ObjectMapper objectMapper,
            Clock clock) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        this.transaction = Objects.requireNonNull(transaction, "transaction is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "object mapper is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> T execute(
            String scope,
            ContentIdempotencyKey key,
            String requestFingerprint,
            Supplier<T> action) {
        Objects.requireNonNull(scope, "idempotency scope is required");
        Objects.requireNonNull(key, "idempotency key is required");
        Objects.requireNonNull(requestFingerprint, "request fingerprint is required");
        Objects.requireNonNull(action, "idempotent action is required");
        T result = transaction.execute(status -> executeInTransaction(scope, key, requestFingerprint, action));
        return Objects.requireNonNull(result, "idempotent action returned null");
    }

    @SuppressWarnings("unchecked")
    private <T> T executeInTransaction(
            String scope,
            ContentIdempotencyKey key,
            String requestFingerprint,
            Supplier<T> action) {
        String storageKey = storageKey(scope, key);
        try {
            try {
                jdbc.update("""
                        INSERT INTO content_idempotency_record
                            (scope, idempotency_key, request_fingerprint, status, response_json, recorded_at)
                        VALUES (?, ?, ?, 'IN_PROGRESS', NULL, ?)
                        """, scope, key.value(), requestFingerprint,
                        java.sql.Timestamp.from(clock.instant()));
            } catch (DuplicateKeyException duplicate) {
                ExistingRecord existing = jdbc.query(
                        "SELECT request_fingerprint, status FROM content_idempotency_record "
                                + "WHERE scope = ? AND idempotency_key = ?",
                        (resultSet, rowNum) -> new ExistingRecord(
                                resultSet.getString("request_fingerprint"), resultSet.getString("status")),
                        scope, key.value()).stream().findFirst().orElseThrow(() ->
                        ContentOperationException.unavailable(
                                "CONTENT_IDEMPOTENCY_UNAVAILABLE", "idempotency reservation could not be read"));
                if (!requestFingerprint.equals(existing.requestFingerprint())) {
                    throw ContentOperationException.conflict(
                            "IDEMPOTENCY_KEY_REUSE", "Idempotency-Key cannot be reused for another command payload");
                }
                Object replay = results.get(storageKey);
                if (replay != null && "COMPLETED".equals(existing.status())) {
                    return (T) replay;
                }
                throw ContentOperationException.unavailable(
                        "IDEMPOTENCY_REPLAY_UNAVAILABLE",
                        "the durable idempotency record cannot be replayed in this process");
            }

            T result = action.get();
            String responseJson = JdbcContentJson.write(
                    objectMapper, result, "idempotency response could not be encoded");
            jdbc.update("""
                    UPDATE content_idempotency_record
                       SET status = 'COMPLETED', response_json = ?, recorded_at = ?
                     WHERE scope = ? AND idempotency_key = ?
                    """, responseJson, java.sql.Timestamp.from(clock.instant()), scope, key.value());
            results.put(storageKey, result);
            return result;
        } catch (DataAccessException exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_IDEMPOTENCY_UNAVAILABLE", "content idempotency record could not be persisted");
        }
    }

    private static String storageKey(String scope, ContentIdempotencyKey key) {
        return scope + ":" + key.value();
    }

    private record ExistingRecord(String requestFingerprint, String status) {
    }
}
