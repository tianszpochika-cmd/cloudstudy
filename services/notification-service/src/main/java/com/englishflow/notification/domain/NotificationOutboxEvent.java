package com.englishflow.notification.domain;

import java.time.Instant;
import java.util.Map;

/** Cross-service fact with a safe, allow-listed attribute set. */
public record NotificationOutboxEvent(
        String eventId,
        String eventName,
        String aggregateType,
        String aggregateId,
        String tenantId,
        String principalId,
        String traceId,
        String requestId,
        Instant occurredAt,
        Map<String, String> attributes) {

    public NotificationOutboxEvent {
        require(eventId, "eventId");
        require(eventName, "eventName");
        require(aggregateType, "aggregateType");
        require(aggregateId, "aggregateId");
        require(tenantId, "tenantId");
        require(principalId, "principalId");
        require(traceId, "traceId");
        require(requestId, "requestId");
        if (occurredAt == null) {
            throw NotificationDomainException.invalid("occurredAt is required");
        }
        attributes = SafeEventAttributes.copy(attributes);
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw NotificationDomainException.invalid(field + " is required");
        }
    }
}
