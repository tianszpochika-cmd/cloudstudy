package com.englishflow.platform.template.data;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Immutable outbox envelope. Persistence/dispatch adapters belong to the copied service and must
 * write it in the same transaction as the service fact; Kafka is not a transaction coordinator.
 */
public record OutboxEvent(
        UUID eventId,
        String ownerDomain,
        String aggregateType,
        String aggregateId,
        String eventType,
        String schemaVersion,
        String dedupeKey,
        String payloadJson,
        String requestId,
        String traceId,
        Instant occurredAt
) {

    private static final Pattern EVENT_TYPE = Pattern.compile("[a-z][a-z0-9]*(\\.[a-z0-9_-]+)+\\.v[0-9]+");
    private static final Pattern VERSION = Pattern.compile("[0-9]+\\.[0-9]+\\.[0-9]+");
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");

    public OutboxEvent {
        Objects.requireNonNull(eventId, "eventId is required");
        requireId(ownerDomain, "ownerDomain");
        requireId(aggregateType, "aggregateType");
        requireId(aggregateId, "aggregateId");
        if (eventType == null || !EVENT_TYPE.matcher(eventType).matches()) {
            throw new IllegalArgumentException("eventType must use domain.action.vN");
        }
        if (schemaVersion == null || !VERSION.matcher(schemaVersion).matches()) {
            throw new IllegalArgumentException("schemaVersion must use semantic versioning");
        }
        requireId(dedupeKey, "dedupeKey");
        if (payloadJson == null || !payloadJson.trim().startsWith("{") || !payloadJson.trim().endsWith("}")) {
            throw new IllegalArgumentException("payloadJson must be a JSON object");
        }
        requireOptionalId(requestId, "requestId");
        requireOptionalId(traceId, "traceId");
        Objects.requireNonNull(occurredAt, "occurredAt is required");
    }

    public static OutboxEvent create(
            String ownerDomain,
            String aggregateType,
            String aggregateId,
            String eventType,
            String schemaVersion,
            String dedupeKey,
            String payloadJson,
            String requestId,
            String traceId
    ) {
        return new OutboxEvent(UUID.randomUUID(), ownerDomain, aggregateType, aggregateId, eventType,
                schemaVersion, dedupeKey, payloadJson, requestId, traceId, Instant.now());
    }

    private static void requireId(String value, String field) {
        if (value == null || !SAFE_ID.matcher(value).matches()) {
            throw new IllegalArgumentException(field + " has an unsafe format");
        }
    }

    private static void requireOptionalId(String value, String field) {
        if (value != null && !SAFE_ID.matcher(value).matches()) {
            throw new IllegalArgumentException(field + " has an unsafe format");
        }
    }
}

