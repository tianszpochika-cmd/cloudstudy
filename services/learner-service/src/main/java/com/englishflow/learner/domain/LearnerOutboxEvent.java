package com.englishflow.learner.domain;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Minimal integration event envelope. A durable adapter must persist it in the same transaction
 * as the profile and idempotency record; this class does not pretend Kafka is available.
 */
public record LearnerOutboxEvent(
        UUID eventId,
        LearnerTenantScope scope,
        String aggregateType,
        String aggregateId,
        String eventType,
        String schemaVersion,
        String dedupeKey,
        Map<String, Object> payload,
        String requestId,
        String traceId,
        Instant occurredAt) {

    public LearnerOutboxEvent {
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
        requireSafe(dedupeKey, "dedupeKey");
        payload = payload == null ? Map.of() : Map.copyOf(payload);
        payload.forEach((key, value) -> {
            requireSafe(key, "payload key");
            validateValue(value);
        });
        requestId = requireRequestId(requestId);
        traceId = requireTraceId(traceId);
        Objects.requireNonNull(occurredAt, "occurredAt is required");
    }

    private static void requireSafe(String value, String field) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) {
            throw new IllegalArgumentException(field + " has an unsafe format");
        }
    }

    public String eventName() {
        return eventType;
    }

    public String schema() {
        return schemaVersion;
    }

    public int version() {
        return 1;
    }

    public String actorId() {
        return scope.subjectId();
    }

    private static String requireRequestId(String value) {
        if (value == null || !value.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) {
            throw new IllegalArgumentException("requestId is required and has an invalid format");
        }
        return value;
    }

    private static String requireTraceId(String value) {
        if (value == null || !value.matches("[a-f0-9]{32}")) {
            throw new IllegalArgumentException("traceId is required and must be 32 lowercase hex characters");
        }
        return value;
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
            if (collection.size() > 32) {
                throw new IllegalArgumentException("payload collections must be bounded");
            }
            collection.forEach(LearnerOutboxEvent::validateValue);
            return;
        }
        if (value instanceof Map<?, ?> map) {
            if (map.size() > 32) {
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
        throw new IllegalArgumentException("payload value type is not supported: " + value.getClass().getName());
    }
}
