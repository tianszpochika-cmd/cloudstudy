package com.englishflow.notification.adapter.jdbc;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationOutboxEvent;
import com.englishflow.notification.port.OutboxEventPort;
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
import java.util.Map;
import java.util.Objects;

/** Append-only owner outbox. It does not publish to Kafka or perform RPC. */
public final class JdbcNotificationOutboxEventPort implements OutboxEventPort {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public JdbcNotificationOutboxEventPort(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    @Override
    public void append(NotificationOutboxEvent event) {
        Objects.requireNonNull(event, "event");
        try {
            jdbc.update("""
                    INSERT INTO notification_outbox_event
                        (event_id, aggregate_type, aggregate_id, event_name, schema_version, dedupe_key, payload_json,
                         status, attempt_count, available_at, created_at, tenant_id, principal_id,
                         trace_id, request_id, occurred_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE event_id = event_id
                    """, event.eventId(), event.aggregateType(), event.aggregateId(), event.eventName(),
                    schemaVersion(event.eventName()), dedupeKey(event), writeJson(event.attributes()), timestamp(event.occurredAt()),
                    timestamp(event.occurredAt()), event.tenantId(), event.principalId(), event.traceId(),
                    event.requestId(), timestamp(event.occurredAt()));
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public List<NotificationOutboxEvent> events() {
        try {
            return jdbc.query("""
                    SELECT event_id, event_name, aggregate_type, aggregate_id, tenant_id, principal_id,
                           trace_id, request_id, occurred_at, payload_json
                    FROM notification_outbox_event
                    ORDER BY created_at, event_id
                    """, (rs, row) -> map(rs));
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    private NotificationOutboxEvent map(ResultSet rs) throws java.sql.SQLException {
        try {
            return new NotificationOutboxEvent(rs.getString("event_id"), rs.getString("event_name"),
                    rs.getString("aggregate_type"), rs.getString("aggregate_id"), rs.getString("tenant_id"),
                    rs.getString("principal_id"), rs.getString("trace_id"), rs.getString("request_id"),
                    rs.getTimestamp("occurred_at").toInstant(),
                    json.readValue(rs.getString("payload_json"), json.getTypeFactory()
                            .constructMapType(Map.class, String.class, String.class)));
        } catch (JacksonException exception) {
            throw unavailable();
        }
    }

    private String writeJson(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw unavailable();
        }
    }

    private static String schemaVersion(String eventName) {
        int marker = eventName.lastIndexOf(".v");
        return marker >= 0 && marker + 2 < eventName.length() ? eventName.substring(marker + 1) : "v1";
    }

    private static String dedupeKey(NotificationOutboxEvent event) {
        String source = event.eventName() + '|' + event.aggregateType() + '|' + event.aggregateId() + '|'
                + event.tenantId() + '|' + event.principalId() + '|' + event.traceId() + '|' + event.requestId()
                + '|' + event.attributes();
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(source.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }

    private static Timestamp timestamp(Instant value) {
        return Timestamp.from(Objects.requireNonNull(value, "occurredAt"));
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification durable persistence is unavailable");
    }
}
