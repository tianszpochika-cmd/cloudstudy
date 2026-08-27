package com.englishflow.notification.adapter.jdbc;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.englishflow.notification.domain.OfflineChange;
import com.englishflow.notification.domain.OfflineSyncReceipt;
import com.englishflow.notification.domain.OfflineVector;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.SyncCursor;
import com.englishflow.notification.domain.SyncFailureState;
import com.englishflow.notification.port.OfflineSyncStore;
import com.englishflow.notification.port.OfflineSyncStoreException;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/** Durable cursor and dedupe facts owned by notification/workflow. */
public final class JdbcOfflineSyncStore implements OfflineSyncStore {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final ObjectMapper json;

    public JdbcOfflineSyncStore(JdbcTemplate jdbc, TransactionTemplate transaction, ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.transaction = Objects.requireNonNull(transaction, "transaction");
        this.json = Objects.requireNonNull(json, "json");
    }

    @Override
    public Optional<OfflineSyncReceipt> findByClientEventId(NotificationPrincipalContext context,
            String clientEventId) {
        try {
            return jdbc.query("""
                    SELECT client_event_id, fingerprint, client_seq, status, server_version, accepted_at
                    FROM offline_sync_receipt
                    WHERE tenant_id = ? AND subject_id = ? AND device_id = ? AND client_event_id = ?
                    """, (rs, row) -> receipt(rs), context.tenantId(), context.principalId(), context.deviceId(),
                    clientEventId).stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<OfflineSyncReceipt> findByClientSequence(NotificationPrincipalContext context, long clientSeq) {
        try {
            return jdbc.query("""
                    SELECT client_event_id, fingerprint, client_seq, status, server_version, accepted_at
                    FROM offline_sync_receipt
                    WHERE tenant_id = ? AND subject_id = ? AND device_id = ? AND client_seq = ?
                    """, (rs, row) -> receipt(rs), context.tenantId(), context.principalId(), context.deviceId(),
                    clientSeq).stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public SyncCursor cursor(NotificationPrincipalContext context) {
        try {
            ensureCursor(context);
            return selectCursor(context, false);
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public void accept(NotificationPrincipalContext context, OfflineChange change,
            SyncCursor expectedCursor, OfflineSyncReceipt receipt, SyncCursor nextCursor) {
        try {
            transaction.executeWithoutResult(status -> {
                ensureCursor(context);
                SyncCursor current = selectCursor(context, true);
                if (!current.equals(expectedCursor)) {
                    throw new IllegalStateException("sync cursor changed before the atomic append");
                }
                jdbc.update("""
                        INSERT INTO offline_sync_receipt
                            (tenant_id, subject_id, device_id, client_event_id, fingerprint,
                             client_seq, status, server_version, accepted_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, context.tenantId(), context.principalId(), context.deviceId(), receipt.clientEventId(),
                        receipt.fingerprint(), receipt.clientSeq(), receipt.status().name(), receipt.serverVersion(),
                        timestamp(receipt.acceptedAt()));
                int updated = jdbc.update("""
                        UPDATE offline_sync_cursor
                        SET client_seq = ?, cursor_version = ?, vector_json = ?, updated_at = ?
                        WHERE tenant_id = ? AND subject_id = ? AND device_id = ?
                        """, nextCursor.lastClientSeq(), nextCursor.serverVersion(), writeVector(nextCursor.vector()),
                        timestamp(nextCursor.updatedAt()), context.tenantId(), context.principalId(), context.deviceId());
                if (updated != 1) {
                    throw new IllegalStateException("sync cursor was not advanced");
                }
            });
        } catch (IllegalStateException exception) {
            throw exception;
        } catch (DuplicateKeyException exception) {
            throw new IllegalStateException("sync receipt already exists", exception);
        } catch (DataAccessException exception) {
            throw new OfflineSyncStoreException(SyncFailureState.NETWORK_UNAVAILABLE);
        }
    }

    @Override
    public Optional<SyncFailureState> failureState() {
        return Optional.empty();
    }

    private void ensureCursor(NotificationPrincipalContext context) {
        jdbc.update("""
                INSERT IGNORE INTO offline_sync_cursor
                    (cursor_id, subject_id, tenant_id, device_id, client_seq, cursor_version, vector_json, updated_at)
                VALUES (UUID(), ?, ?, ?, 0, 0, '{}', ?)
                """, context.principalId(), context.tenantId(), context.deviceId(), timestamp(Instant.now()));
    }

    private SyncCursor selectCursor(NotificationPrincipalContext context, boolean forUpdate) {
        String suffix = forUpdate ? " FOR UPDATE" : "";
        return jdbc.query("""
                SELECT tenant_id, subject_id, device_id, client_seq, cursor_version, vector_json, updated_at
                FROM offline_sync_cursor
                WHERE tenant_id = ? AND subject_id = ? AND device_id = ?
                """ + suffix, (rs, row) -> cursor(rs), context.tenantId(), context.principalId(), context.deviceId())
                .stream().findFirst().orElseThrow(() -> unavailable());
    }

    private OfflineSyncReceipt receipt(ResultSet rs) throws java.sql.SQLException {
        return new OfflineSyncReceipt(rs.getString("client_event_id"), rs.getString("fingerprint"),
                rs.getLong("client_seq"), com.englishflow.notification.domain.SyncStatus.valueOf(rs.getString("status")),
                rs.getLong("server_version"), rs.getTimestamp("accepted_at").toInstant());
    }

    private SyncCursor cursor(ResultSet rs) throws java.sql.SQLException {
        return new SyncCursor(rs.getString("tenant_id"), rs.getString("subject_id"), rs.getString("device_id"),
                rs.getLong("client_seq"), rs.getLong("cursor_version"), readVector(rs.getString("vector_json")),
                rs.getTimestamp("updated_at").toInstant());
    }

    private OfflineVector readVector(String value) {
        try {
            JsonNode root = json.readTree(value == null || value.isBlank() ? "{}" : value);
            Map<String, Long> values = new LinkedHashMap<>();
            if (root != null && root.isObject()) {
                for (Map.Entry<String, JsonNode> entry : root.properties()) {
                    values.put(entry.getKey(), entry.getValue().asLong());
                }
            }
            return new OfflineVector(values);
        } catch (JacksonException exception) {
            throw unavailable();
        }
    }

    private String writeVector(OfflineVector vector) {
        try {
            return json.writeValueAsString(vector.values());
        } catch (JacksonException exception) {
            throw unavailable();
        }
    }

    private static Timestamp timestamp(Instant value) {
        return Timestamp.from(value);
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification offline-sync persistence is unavailable");
    }
}
