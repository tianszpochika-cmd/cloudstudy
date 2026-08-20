package com.englishflow.modules.user.domain;

import java.time.Instant;
import java.util.Map;

/** Event payload is deliberately limited to safe identifiers and enum-like values. */
public record UserDomainEvent(
        String eventId,
        String eventName,
        String aggregateType,
        String aggregateId,
        String tenantId,
        long userId,
        String actorId,
        String requestId,
        String traceId,
        Instant occurredAt,
        Map<String, Object> payload
) {
    public UserDomainEvent {
        payload = Map.copyOf(payload);
    }
}
