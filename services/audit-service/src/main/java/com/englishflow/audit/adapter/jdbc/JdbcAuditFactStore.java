package com.englishflow.audit.adapter.jdbc;

import java.util.UUID;

import com.englishflow.audit.domain.AuditDomainException;
import com.englishflow.audit.domain.AuditEvent;
import com.englishflow.audit.domain.AuditFactStore;

import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.databind.ObjectMapper;

public final class JdbcAuditFactStore implements AuditFactStore {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public JdbcAuditFactStore(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Override
    public IngestResult ingest(AuditEvent event) {
        String payloadJson = serialize(event);
        int inserted = jdbc.update(
                "INSERT IGNORE INTO audit_ingest_receipt (event_id, source_service, schema_version, payload_digest, "
                        + "request_id, trace_id, received_at) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(6))",
                event.eventId().toString(), event.sourceService(), event.schemaVersion(),
                sha256Hex(payloadJson), event.requestId(), event.traceId());
        if (inserted == 0) {
            return new IngestResult(IngestStatus.DUPLICATE, existingAuditId(event.eventId()));
        }
        UUID auditId = UUID.randomUUID();
        jdbc.update("INSERT INTO audit_fact (audit_id, event_id, tenant_id, actor_subject_hash, action, decision, "
                        + "reason_code, occurred_at, request_id, trace_id, schema_version, redacted_payload, "
                        + "legal_hold, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), FALSE, "
                        + "UTC_TIMESTAMP(6))",
                auditId.toString(), event.eventId().toString(), event.tenantId(), event.actorSubjectHash(),
                event.action(), event.decision(), event.reasonCode(),
                java.sql.Timestamp.from(event.occurredAt()), event.requestId(), event.traceId(),
                event.schemaVersion(), payloadJson);
        return new IngestResult(IngestStatus.ACCEPTED, auditId);
    }

    private UUID existingAuditId(UUID eventId) {
        String auditId = jdbc.queryForObject(
                "SELECT audit_id FROM audit_fact WHERE event_id = ?", String.class, eventId.toString());
        return auditId == null ? null : UUID.fromString(auditId);
    }

    private String serialize(AuditEvent event) {
        try {
            return objectMapper.writeValueAsString(event.redactedPayload());
        } catch (RuntimeException failure) {
            throw AuditDomainException.invalid("redacted payload is not serializable");
        }
    }

    private static String sha256Hex(String value) {
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(64);
            for (byte item : digest) {
                result.append(String.format("%02x", item));
            }
            return result.toString();
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the JDK", exception);
        }
    }
}
