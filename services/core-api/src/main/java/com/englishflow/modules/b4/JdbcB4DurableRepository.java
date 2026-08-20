package com.englishflow.modules.b4;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@ConditionalOnProperty(prefix = "englishflow.b4", name = "persistence", havingValue = "jdbc")
public final class JdbcB4DurableRepository implements B4DurableRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public JdbcB4DurableRepository(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Override
    public void append(Fact fact) {
        jdbc.update("""
                INSERT INTO b4_durable_fact
                (aggregate_type, aggregate_id, user_id, request_id, idempotency_key, occurred_at, payload_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, fact.aggregateType(), fact.aggregateId(), fact.userId(), fact.requestId(),
                fact.idempotencyKey(), Timestamp.from(fact.occurredAt()), json(fact.payload()));
    }

    @Override
    public List<Fact> list(String aggregateType, long userId) {
        return jdbc.query("""
                SELECT aggregate_type, aggregate_id, user_id, request_id, idempotency_key, occurred_at, payload_json
                FROM b4_durable_fact WHERE aggregate_type = ? AND user_id = ? ORDER BY id
                """, (rs, rowNum) -> new Fact(rs.getString("aggregate_type"), rs.getString("aggregate_id"),
                rs.getLong("user_id"), rs.getString("request_id"), rs.getString("idempotency_key"),
                rs.getTimestamp("occurred_at").toInstant(), readMap(rs.getString("payload_json"))), aggregateType, userId);
    }

    private String json(Map<String, Object> value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException exception) { throw new B4Exception("B4_PERSISTENCE_SERIALIZE_FAILED", "B4 fact could not be serialized", 500, true); }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readMap(String value) {
        try { return objectMapper.readValue(value, Map.class); }
        catch (JsonProcessingException exception) { throw new B4Exception("B4_PERSISTENCE_READ_FAILED", "B4 fact could not be read", 500, true); }
    }
}
