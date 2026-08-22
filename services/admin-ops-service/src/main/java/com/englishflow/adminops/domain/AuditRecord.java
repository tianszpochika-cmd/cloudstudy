package com.englishflow.adminops.domain;

import java.time.Instant;
import java.util.Map;

/** Immutable, hash-chained audit record. Actor and tenant are stored only as opaque references. */
public record AuditRecord(
        String auditId,
        String tenantRef,
        String actorRef,
        String operation,
        String resourceRef,
        String commandId,
        String traceId,
        String decisionId,
        Map<String, String> safeContext,
        Instant occurredAt,
        String previousHash,
        String recordHash) {

    public AuditRecord {
        safeContext = safeContext == null ? Map.of() : Map.copyOf(safeContext);
    }

    public static AuditRecord create(AuditEvent event, String previousHash, String auditId) {
        String tenantRef = ReferenceRedactor.tenant(event.tenantId());
        String actorRef = ReferenceRedactor.subject(event.actorSubjectId());
        String hashInput = auditId + "|" + tenantRef + "|" + actorRef + "|" + event.operation() + "|"
                + event.resourceRef() + "|" + String.valueOf(event.commandId()) + "|" + event.traceId() + "|"
                + event.decisionId() + "|" + event.safeContext() + "|" + event.occurredAt() + "|"
                + String.valueOf(previousHash);
        return new AuditRecord(auditId, tenantRef, actorRef, event.operation(), event.resourceRef(), event.commandId(),
                event.traceId(), event.decisionId(), event.safeContext(), event.occurredAt(), previousHash,
                ReferenceRedactor.sha256(hashInput));
    }

    /** Recomputes the chain value without exposing raw identity values. */
    public boolean integrityMatches() {
        String hashInput = auditId + "|" + tenantRef + "|" + actorRef + "|" + operation + "|"
                + resourceRef + "|" + String.valueOf(commandId) + "|" + traceId + "|" + decisionId + "|"
                + safeContext + "|" + occurredAt + "|" + String.valueOf(previousHash);
        return recordHash.equals(ReferenceRedactor.sha256(hashInput));
    }
}
