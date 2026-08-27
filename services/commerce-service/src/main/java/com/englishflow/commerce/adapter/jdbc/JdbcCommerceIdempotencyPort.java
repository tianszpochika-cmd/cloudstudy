package com.englishflow.commerce.adapter.jdbc;

import com.englishflow.commerce.application.ports.IdempotencyPort;
import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.CommerceViews;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

public final class JdbcCommerceIdempotencyPort implements IdempotencyPort {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JdbcCommerceIdempotencyPort(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public Optional<Record> find(String tenantId, String subjectId, String operation, String key) {
        try {
            return Optional.of(jdbc.queryForObject("SELECT tenant_id, subject_id, operation, idempotency_key, request_fingerprint, response_json, created_at "
                    + "FROM commerce_idempotency_record WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?",
                    (rs, row) -> new Record(rs.getString("tenant_id"), rs.getString("subject_id"), rs.getString("operation"), rs.getString("idempotency_key"),
                            rs.getString("request_fingerprint"), decode(operation, rs.getString("response_json")), rs.getTimestamp("created_at").toInstant()),
                    tenantId, subjectId, operation, key));
        } catch (EmptyResultDataAccessException ignored) {
            return Optional.empty();
        }
    }

    @Override
    public void save(Record record) {
        jdbc.update("INSERT INTO commerce_idempotency_record (tenant_id, subject_id, operation, idempotency_key, request_fingerprint, state, response_json, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?) ON DUPLICATE KEY UPDATE response_json = VALUES(response_json), state = VALUES(state), updated_at = VALUES(updated_at)",
                record.tenantId(), record.subjectId(), record.operation(), record.key(), record.requestFingerprint(), encode(record.response()),
                Timestamp.from(record.recordedAt()), Timestamp.from(record.recordedAt()));
    }

    private String encode(Object value) {
        try {
            return value == null ? null : mapper.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw CommerceException.unavailable("COMMERCE_IDEMPOTENCY_SERIALIZATION", "commerce response could not be persisted");
        }
    }

    private Object decode(String operation, String json) {
        if (json == null || json.isBlank()) return null;
        Class<?> type = switch (operation) {
            case "order.create", "order.cancel" -> CommerceViews.OrderView.class;
            case "payment.start", "payment.recover" -> CommerceViews.PaymentStartView.class;
            case "activation.redeem" -> CommerceViews.ActivationRedeemView.class;
            case "activation.issue" -> CommerceViews.ActivationCodeIssueView.class;
            case "refund.request" -> CommerceViews.RefundView.class;
            default -> Object.class;
        };
        try {
            return mapper.readValue(json, type);
        } catch (JacksonException exception) {
            throw CommerceException.unavailable("COMMERCE_IDEMPOTENCY_READ", "persisted commerce replay could not be decoded");
        }
    }
}
