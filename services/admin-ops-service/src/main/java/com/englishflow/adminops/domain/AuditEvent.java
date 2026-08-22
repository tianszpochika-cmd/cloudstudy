package com.englishflow.adminops.domain;

import java.time.Instant;
import java.util.Map;

/** Raw event accepted by the internal audit port; values are restricted to safe codes. */
public record AuditEvent(
        String tenantId,
        String actorSubjectId,
        String operation,
        String resourceRef,
        String commandId,
        String traceId,
        String decisionId,
        Map<String, String> safeContext,
        Instant occurredAt) {

    public AuditEvent {
        if (tenantId == null || tenantId.isBlank() || actorSubjectId == null || actorSubjectId.isBlank()
                || operation == null || operation.isBlank() || resourceRef == null || resourceRef.isBlank()
                || traceId == null || traceId.isBlank() || decisionId == null || decisionId.isBlank()
                || occurredAt == null) {
            throw AdminOpsException.invalid("ADMIN_AUDIT_EVENT_INVALID", "audit association is incomplete");
        }
        safeContext = safeContext == null ? Map.of() : Map.copyOf(safeContext);
    }
}
