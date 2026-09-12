package com.englishflow.audit.domain;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public record AuditEvent(
        UUID eventId,
        String sourceService,
        String schemaVersion,
        String tenantId,
        String actorSubjectHash,
        String action,
        String decision,
        String reasonCode,
        Instant occurredAt,
        String requestId,
        String traceId,
        Map<String, Object> redactedPayload) {

    public AuditEvent {
        Objects.requireNonNull(eventId, "eventId");
        Objects.requireNonNull(sourceService, "sourceService");
        Objects.requireNonNull(schemaVersion, "schemaVersion");
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(actorSubjectHash, "actorSubjectHash");
        Objects.requireNonNull(action, "action");
        Objects.requireNonNull(decision, "decision");
        Objects.requireNonNull(occurredAt, "occurredAt");
        redactedPayload = redactedPayload == null ? Map.of() : Map.copyOf(redactedPayload);
        if (!"platform".equals(tenantId)) {
            throw AuditDomainException.invalid("tenant is not allowed");
        }
        if (!"ALLOW".equals(decision) && !"DENY".equals(decision)) {
            throw AuditDomainException.invalid("decision must be ALLOW or DENY");
        }
        if (actorSubjectHash.length() != 64) {
            throw AuditDomainException.invalid("actor subject hash must be a sha256 hex digest");
        }
    }
}
