package com.englishflow.notification.adapter.jdbc;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.englishflow.notification.domain.NotificationAuditEvent;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.port.NotificationAuditEventPort;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Durable append-only notification audit facts. */
public final class JdbcNotificationAuditEventStore implements NotificationAuditEventPort {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public JdbcNotificationAuditEventStore(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    @Override
    public void append(NotificationAuditEvent event) {
        Objects.requireNonNull(event, "event");
        try {
            jdbc.update("""
                    INSERT INTO notification_audit_event
                        (audit_id, action, outcome, actor_id, tenant_id, principal_id, aggregate_type,
                         aggregate_id, request_id, trace_id, occurred_at, attributes_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE audit_id = audit_id
                    """, event.auditId(), event.action(), event.outcome(), event.actorId(), event.tenantId(),
                    event.principalId(), event.aggregateType(), event.aggregateId(), event.requestId(),
                    event.traceId(), Timestamp.from(event.occurredAt()), writeJson(event.attributes()));
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public List<NotificationAuditEvent> events() {
        try {
            return jdbc.query("""
                    SELECT audit_id, action, outcome, actor_id, tenant_id, principal_id, aggregate_type,
                           aggregate_id, request_id, trace_id, occurred_at, attributes_json
                    FROM notification_audit_event
                    ORDER BY occurred_at, audit_id
                    """, (rs, row) -> {
                try {
                    Map<String, String> attributes = json.readValue(rs.getString("attributes_json"),
                            json.getTypeFactory().constructMapType(Map.class, String.class, String.class));
                    return new NotificationAuditEvent(rs.getString("audit_id"), rs.getString("action"),
                            rs.getString("outcome"), rs.getString("actor_id"), rs.getString("tenant_id"),
                            rs.getString("principal_id"), rs.getString("aggregate_type"),
                            rs.getString("aggregate_id"), rs.getString("request_id"), rs.getString("trace_id"),
                            rs.getTimestamp("occurred_at").toInstant(), attributes);
                } catch (JacksonException exception) {
                    throw unavailable();
                }
            });
        } catch (DataAccessException exception) {
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

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification durable persistence is unavailable");
    }
}
