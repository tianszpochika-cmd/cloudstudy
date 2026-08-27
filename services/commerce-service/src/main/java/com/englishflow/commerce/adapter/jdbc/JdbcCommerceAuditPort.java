package com.englishflow.commerce.adapter.jdbc;

import com.englishflow.commerce.application.ports.AuditPort;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;

public final class JdbcCommerceAuditPort implements AuditPort {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JdbcCommerceAuditPort(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public void append(AuditRecord record) {
        try {
            jdbc.update("INSERT INTO commerce_audit_record (audit_id, tenant_id, actor_ref, action, aggregate_type, aggregate_id, outcome, attributes_json, occurred_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", record.auditId(), record.tenantId(), record.actorRef(), record.action(), record.aggregateType(),
                    record.aggregateId(), record.outcome(), mapper.writeValueAsString(record.attributes()), Timestamp.from(record.occurredAt()));
        } catch (JacksonException exception) {
            throw new IllegalStateException("commerce audit attributes cannot be serialized", exception);
        }
    }
}
