package com.englishflow.media.adapter.jdbc;

import com.englishflow.media.domain.MediaEvent;
import com.englishflow.media.port.MediaEventPort;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.util.Map;
import java.util.Objects;

/**
 * M3-004: service-owned durable outbox adapter. Payloads stay metadata-only
 * (the domain type is already {@code Map<String, String>}); dedupe rides the
 * schema unique key on {@code dedupe_key}, fed by the domain event id.
 */
public final class JdbcMediaEventOutbox implements MediaEventPort {

    private final JdbcTemplate jdbc;
    private final String schema;

    public JdbcMediaEventOutbox(JdbcTemplate jdbc, String schema) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        if (schema == null || !schema.matches("[A-Za-z0-9_]{1,64}")) {
            throw new IllegalArgumentException("schema is invalid");
        }
        this.schema = schema;
    }

    @Override
    public void append(MediaEvent event) {
        Objects.requireNonNull(event, "event is required");
        Timestamp now = Timestamp.from(event.occurredAt());
        jdbc.update("INSERT INTO `" + schema + "`.`media_outbox_event` "
                        + "(event_id, aggregate_id, event_name, schema_version, dedupe_key, payload_json, status, attempt_count, available_at, created_at, occurred_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?) ON DUPLICATE KEY UPDATE dedupe_key=VALUES(dedupe_key)",
                event.eventId(), event.aggregateId(), event.eventName(), Integer.toString(event.schemaVersion()),
                event.eventId(), toJson(event.payload()), now, now, now);
    }

    static String toJson(Map<String, String> payload) {
        StringBuilder json = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> entry : payload.entrySet()) {
            if (!first) json.append(',');
            first = false;
            json.append('"').append(escape(entry.getKey())).append("\":\"").append(escape(entry.getValue())).append('"');
        }
        return json.append('}').toString();
    }

    private static String escape(String value) {
        StringBuilder escaped = new StringBuilder(value.length() + 8);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (c < 0x20) escaped.append(String.format("\\u%04x", (int) c));
                    else escaped.append(c);
                }
            }
        }
        return escaped.toString();
    }
}
