package com.englishflow.commerce.application.ports;

import java.time.Instant;
import java.util.Map;

public interface AuditPort {
    void append(AuditRecord record);

    record AuditRecord(String auditId, String tenantId, String actorRef, String action,
            String aggregateType, String aggregateId, String outcome, Instant occurredAt,
            Map<String, String> attributes) {
        public AuditRecord {
            attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
        }
    }
}
