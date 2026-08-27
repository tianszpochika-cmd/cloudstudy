package com.englishflow.assessment.adapter.jdbc;

import com.englishflow.assessment.domain.AssessmentDomainException;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/** Service-owned durable outbox adapter.  Dedupe is enforced by the schema unique key. */
public final class JdbcAssessmentOutbox implements AssessmentOutboxPort {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final String schema;

    public JdbcAssessmentOutbox(JdbcTemplate jdbc, ObjectMapper objectMapper, String schema) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
        if (schema == null || !schema.matches("[A-Za-z0-9_]{1,64}")) throw new IllegalArgumentException("schema is invalid");
        this.schema = schema;
    }

    @Override
    public void append(AssessmentOutboxEvent event) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("aggregateType", event.aggregateType());
        envelope.put("tenantId", event.tenantId());
        envelope.put("actorId", event.actorId());
        envelope.put("requestId", event.requestId());
        envelope.put("traceId", event.traceId());
        envelope.put("version", event.version());
        envelope.put("payload", event.payload());
        String json;
        try {
            json = objectMapper.writeValueAsString(envelope);
        } catch (JacksonException exception) {
            throw AssessmentDomainException.retryable("ASM_OUTBOX_SERIALIZATION", "outbox payload cannot be serialized");
        }
        jdbc.update("INSERT INTO `" + schema + "`.`assessment_outbox_event` "
                        + "(event_id, aggregate_id, event_name, schema_version, dedupe_key, payload_json, status, attempt_count, available_at, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?) ON DUPLICATE KEY UPDATE dedupe_key=VALUES(dedupe_key)",
                event.eventId().toString(), event.aggregateId(), event.eventName(), event.schemaVersion(), event.dedupeKey(),
                json, Timestamp.from(event.occurredAt()), Timestamp.from(event.occurredAt()));
    }
}
