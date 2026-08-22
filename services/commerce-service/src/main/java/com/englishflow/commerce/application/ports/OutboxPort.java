package com.englishflow.commerce.application.ports;

import java.time.Instant;
import java.util.Map;

public interface OutboxPort {
    void append(Event event);

    record Event(String eventId, String tenantId, String aggregateType, String aggregateId,
            String eventType, int schemaVersion, Instant occurredAt, Map<String, String> payload) {
        public Event {
            payload = payload == null ? Map.of() : Map.copyOf(payload);
        }
    }
}
