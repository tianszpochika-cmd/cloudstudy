package com.englishflow.commerce.adapter.jdbc;

import com.englishflow.commerce.application.ports.OutboxPort;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;

public final class JdbcCommerceOutboxPort implements OutboxPort {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JdbcCommerceOutboxPort(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public void append(Event event) {
        try {
            String payload = mapper.writeValueAsString(event.payload());
            // P1-LIVE-007: the V2 standardize migration tightened event_name /
            // dedupe_key / occurred_at to NOT NULL; the writer still used the
            // legacy 12-column shape, so every order/payment/refund write rolled
            // back and surfaced as a 403 via the /error denyAll mask. event_name
            // follows the migration backfill convention (event_type); dedupe_key
            // follows SHA2(event_id).
            jdbc.update("INSERT INTO commerce_outbox_event (event_id, tenant_id, aggregate_type, aggregate_id, event_type, schema_version, payload_json, payload_hash, state, created_at, "
                    + "event_name, dedupe_key, occurred_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)", event.eventId(), event.tenantId(), event.aggregateType(), event.aggregateId(), event.eventType(),
                    event.schemaVersion(), payload, sha256(payload), Timestamp.from(event.occurredAt()),
                    event.eventType(), sha256(event.eventId()), Timestamp.from(event.occurredAt()));
        } catch (JacksonException exception) {
            throw new IllegalStateException("commerce outbox payload cannot be serialized", exception);
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
