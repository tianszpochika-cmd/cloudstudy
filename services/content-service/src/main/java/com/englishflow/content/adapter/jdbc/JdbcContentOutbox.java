package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentOutboxEvent;
import com.englishflow.content.port.ContentOutboxPort;

import java.sql.Timestamp;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Content-owned transactional outbox row writer; Kafka delivery is outside this adapter. */
public final class JdbcContentOutbox implements ContentOutboxPort {

    private static final String INSERT_SQL = """
            INSERT INTO content_outbox_event
                (event_id, owner_domain, aggregate_type, aggregate_id, event_name, schema_version,
                 event_version, actor_id, dedupe_key, payload_json, status, attempt_count,
                 available_at, request_id, trace_id, occurred_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?, ?, ?)
            """;

    private final JdbcTemplate jdbc;

    public JdbcContentOutbox(JdbcTemplate jdbc) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc is required");
    }

    @Override
    public void appendAfterFact(ContentOutboxEvent event) {
        java.util.Objects.requireNonNull(event, "outbox event is required");
        try {
            jdbc.update(INSERT_SQL,
                    event.eventId().toString(), event.ownerDomain(), event.aggregateType(), event.aggregateId(),
                    event.eventType(), event.schemaVersion(), event.version(), event.actorId(), event.dedupeKey(),
                    event.payloadJson(), Timestamp.from(event.occurredAt()), event.requestId(), event.traceId(),
                    Timestamp.from(event.occurredAt()), Timestamp.from(event.occurredAt()));
        } catch (DuplicateKeyException exception) {
            ExistingEvent existing = jdbc.query(
                    "SELECT event_name, schema_version, event_version, actor_id, payload_json, request_id, trace_id "
                            + "FROM content_outbox_event WHERE dedupe_key = ?",
                    (resultSet, rowNum) -> new ExistingEvent(
                            resultSet.getString("event_name"), resultSet.getString("schema_version"),
                            resultSet.getInt("event_version"), resultSet.getString("actor_id"),
                            resultSet.getString("payload_json"), resultSet.getString("request_id"),
                            resultSet.getString("trace_id")), event.dedupeKey())
                    .stream().findFirst().orElseThrow(() -> ContentOperationException.unavailable(
                            "CONTENT_OUTBOX_UNAVAILABLE", "existing outbox fact could not be read"));
            if (!existing.sameFact(event)) {
                throw ContentOperationException.conflict(
                        "OUTBOX_DEDUPE_CONFLICT", "outbox dedupe key was reused for another event");
            }
        } catch (DataAccessException exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_OUTBOX_UNAVAILABLE", "content outbox event could not be persisted");
        }
    }

    private record ExistingEvent(
            String eventType,
            String schemaVersion,
            int version,
            String actorId,
            String payloadJson,
            String requestId,
            String traceId) {

        boolean sameFact(ContentOutboxEvent event) {
            return eventType.equals(event.eventType())
                    && schemaVersion.equals(event.schemaVersion())
                    && version == event.version()
                    && actorId.equals(event.actorId())
                    && payloadJson.equals(event.payloadJson())
                    && requestId.equals(event.requestId())
                    && traceId.equals(event.traceId());
        }
    }
}
