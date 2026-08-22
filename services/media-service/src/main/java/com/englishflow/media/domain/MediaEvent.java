package com.englishflow.media.domain;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Safe event envelope. The payload type is string metadata so raw media bytes cannot accidentally
 * be put in an event by this service.
 */
public record MediaEvent(
        String eventId,
        String eventName,
        int schemaVersion,
        Instant occurredAt,
        String aggregateType,
        String aggregateId,
        String tenantId,
        String subjectId,
        Map<String, String> payload) {

    public MediaEvent {
        eventId = MediaValidation.id(eventId, "eventId");
        eventName = MediaValidation.id(eventName, "eventName");
        if (schemaVersion <= 0 || occurredAt == null) {
            throw MediaOperationException.badRequest("MEDIA_EVENT_INVALID", "event facts are incomplete");
        }
        aggregateType = MediaValidation.text(aggregateType, "aggregateType", 64);
        aggregateId = MediaValidation.id(aggregateId, "aggregateId");
        tenantId = MediaValidation.id(tenantId, "tenantId");
        subjectId = MediaValidation.id(subjectId, "subjectId");
        payload = payload == null ? Map.of() : Map.copyOf(payload);
    }

    public static MediaEvent create(
            String eventName,
            Instant occurredAt,
            String aggregateId,
            String tenantId,
            String subjectId,
            Map<String, String> payload) {
        return new MediaEvent(
                "evt-" + UUID.randomUUID(), eventName, 1, occurredAt, "media_asset", aggregateId,
                tenantId, subjectId, payload);
    }
}
