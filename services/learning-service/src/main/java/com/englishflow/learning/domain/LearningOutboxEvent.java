package com.englishflow.learning.domain;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Learning integration event envelope; serialization/Kafka delivery belongs to a later adapter. */
public record LearningOutboxEvent(
        UUID eventId,
        LearningTenantScope scope,
        String aggregateType,
        String aggregateId,
        String eventType,
        String schemaVersion,
        int version,
        String actorId,
        String dedupeKey,
        Map<String, Object> payload,
        String requestId,
        String traceId,
        Instant occurredAt) {

    public LearningOutboxEvent {
        Objects.requireNonNull(eventId, "eventId is required");
        Objects.requireNonNull(scope, "scope is required");
        requireSafe(aggregateType, "aggregateType");
        requireSafe(aggregateId, "aggregateId");
        if (eventType == null || !eventType.matches("[a-z][a-z0-9]*(\\.[a-z0-9_-]+)+\\.v[0-9]+")) {
            throw new IllegalArgumentException("eventType must use domain.action.vN");
        }
        if (schemaVersion == null || !schemaVersion.matches("[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+")) {
            throw new IllegalArgumentException("schemaVersion must use domain.event.vN");
        }
        if (version < 1) {
            throw new IllegalArgumentException("event version must be positive");
        }
        requireSafe(actorId, "actorId");
        requireSafe(dedupeKey, "dedupeKey");
        payload = payload == null ? Map.of() : Map.copyOf(payload);
        payload.forEach((key, value) -> {
            requireSafe(key, "payload key");
            validateValue(value);
        });
        if (requestId == null || !requestId.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) {
            throw new IllegalArgumentException("requestId is invalid");
        }
        if (traceId == null || !traceId.matches("[a-f0-9]{32}")) {
            throw new IllegalArgumentException("traceId is invalid");
        }
        Objects.requireNonNull(occurredAt, "occurredAt is required");
    }

    public String eventName() {
        return eventType;
    }

    public String schema() {
        return schemaVersion;
    }

    private static void requireSafe(String value, String field) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) {
            throw new IllegalArgumentException(field + " has an unsafe format");
        }
    }

    private static void validateValue(Object value) {
        if (value == null) {
            throw new IllegalArgumentException("payload values cannot be null");
        }
        if (value instanceof String string) {
            if (string.length() > 256) {
                throw new IllegalArgumentException("payload string values must be bounded");
            }
            return;
        }
        if (value instanceof Number || value instanceof Boolean) {
            return;
        }
        if (value instanceof Collection<?> collection) {
            if (collection.size() > 64) {
                throw new IllegalArgumentException("payload collections must be bounded");
            }
            collection.forEach(LearningOutboxEvent::validateValue);
            return;
        }
        if (value instanceof Map<?, ?> map) {
            if (map.size() > 64) {
                throw new IllegalArgumentException("payload maps must be bounded");
            }
            map.forEach((key, nestedValue) -> {
                if (!(key instanceof String stringKey)) {
                    throw new IllegalArgumentException("payload map keys must be strings");
                }
                requireSafe(stringKey, "nested payload key");
                validateValue(nestedValue);
            });
            return;
        }
        throw new IllegalArgumentException("unsupported payload value: " + value.getClass().getName());
    }
}
