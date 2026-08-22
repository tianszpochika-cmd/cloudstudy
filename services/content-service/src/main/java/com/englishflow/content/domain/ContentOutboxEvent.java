package com.englishflow.content.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/** Immutable integration fact envelope for at-least-once delivery and replay. */
public record ContentOutboxEvent(
        UUID eventId,
        String ownerDomain,
        String aggregateType,
        String aggregateId,
        String eventType,
        String schemaVersion,
        int version,
        String actorId,
        String dedupeKey,
        String payloadJson,
        String requestId,
        String traceId,
        Instant occurredAt) {

    private static final Pattern EVENT_TYPE = Pattern.compile("[a-z][a-z0-9]*(\\.[a-z0-9_-]+)+\\.v[0-9]+");
    private static final Pattern SCHEMA = Pattern.compile("[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+");
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{1,127}");

    public ContentOutboxEvent {
        Objects.requireNonNull(eventId, "event id is required");
        requireId(ownerDomain, "ownerDomain");
        requireId(aggregateType, "aggregateType");
        requireId(aggregateId, "aggregateId");
        if (eventType == null || !EVENT_TYPE.matcher(eventType).matches()) {
            throw ContentOperationException.badRequest("EVENT_TYPE_INVALID", "event type must use domain.action.vN");
        }
        if (schemaVersion == null || !SCHEMA.matcher(schemaVersion).matches()) {
            throw ContentOperationException.badRequest("EVENT_SCHEMA_INVALID", "event schema must use domain.event.vN");
        }
        if (version < 1) {
            throw ContentOperationException.badRequest("EVENT_VERSION_INVALID", "event version must be positive");
        }
        requireActorId(actorId);
        requireId(dedupeKey, "dedupeKey");
        if (payloadJson == null || !payloadJson.trim().startsWith("{") || !payloadJson.trim().endsWith("}")) {
            throw ContentOperationException.badRequest("EVENT_PAYLOAD_INVALID", "event payload must be a JSON object");
        }
        requireId(requestId, "requestId");
        requireId(traceId, "traceId");
        Objects.requireNonNull(occurredAt, "event time is required");
    }

    public static ContentOutboxEvent create(
            String aggregateType,
            String aggregateId,
            String eventType,
            String actorId,
            String dedupeKey,
            String payloadJson,
            ContentRequestContext context,
            Instant occurredAt) {
        return new ContentOutboxEvent(
                UUID.randomUUID(),
                "content-service",
                aggregateType,
                aggregateId,
                eventType,
                "content.event.v1",
                1,
                actorId,
                dedupeKey,
                payloadJson,
                context.requestId(),
                context.traceId(),
                occurredAt);
    }

    public String eventName() {
        return eventType;
    }

    public String schema() {
        return schemaVersion;
    }

    private static void requireId(String value, String field) {
        if (value == null || !SAFE_ID.matcher(value).matches()) {
            throw ContentOperationException.badRequest("EVENT_ID_INVALID", field + " has an unsafe format");
        }
    }

    private static void requireActorId(String value) {
        if (value == null || value.length() > 64 || !SAFE_ID.matcher(value).matches()) {
            throw ContentOperationException.badRequest("EVENT_ACTOR_INVALID", "actorId has an unsafe format");
        }
    }
}
