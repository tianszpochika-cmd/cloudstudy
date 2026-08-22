package com.englishflow.notification.domain;

import java.time.Instant;
import java.util.Map;

/** Append-only audit fact. It is intentionally metadata-only and immutable. */
public record NotificationAuditEvent(
        String auditId,
        String action,
        String outcome,
        String actorId,
        String tenantId,
        String principalId,
        String aggregateType,
        String aggregateId,
        String requestId,
        String traceId,
        Instant occurredAt,
        Map<String, String> attributes) {

    public NotificationAuditEvent {
        require(auditId, "auditId");
        requireToken(action, "action", 96);
        requireToken(outcome, "outcome", 48);
        requireToken(actorId, "actorId", 128);
        requireToken(tenantId, "tenantId", 64);
        requireToken(principalId, "principalId", 128);
        requireToken(aggregateType, "aggregateType", 64);
        requireToken(aggregateId, "aggregateId", 128);
        requireToken(requestId, "requestId", 128);
        if (traceId == null || traceId.isBlank() || traceId.length() > 128
                || traceId.contains("\n") || traceId.contains("\r")) {
            throw NotificationDomainException.invalid("traceId is invalid");
        }
        if (occurredAt == null) throw NotificationDomainException.invalid("audit occurredAt is required");
        attributes = SafeEventAttributes.copy(attributes);
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) throw NotificationDomainException.invalid(field + " is required");
    }

    private static void requireToken(String value, String field, int maxLength) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0," + (maxLength - 1) + "}")) {
            throw NotificationDomainException.invalid(field + " is invalid");
        }
    }
}
