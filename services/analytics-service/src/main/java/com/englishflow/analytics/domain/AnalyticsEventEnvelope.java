package com.englishflow.analytics.domain;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Trusted event envelope after tenant/source identity has been supplied by the security adapter. */
public record AnalyticsEventEnvelope(
        String eventId,
        String eventName,
        String schema,
        int version,
        Instant occurredAt,
        String aggregateType,
        String aggregateId,
        String actorRef,
        String traceId,
        String requestId,
        String schemaVersion,
        String dedupeKey,
        String sourceService,
        String tenantId,
        Map<String, Object> payload
) {

    private static final Set<String> BODY_FIELDS = Set.of(
            "eventId", "eventName", "schema", "version", "occurredAt", "aggregateType", "aggregateId",
            "actorId", "traceId", "requestId", "schemaVersion", "dedupeKey", "payload");

    public AnalyticsEventEnvelope {
        AnalyticsPrivacyBoundary.requireOpaqueReference(eventId, "eventId");
        AnalyticsPrivacyBoundary.requireOpaqueReference(eventName, "eventName");
        AnalyticsPrivacyBoundary.requireOpaqueReference(schema, "schema");
        if (version < 1 || occurredAt == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.ENVELOPE_INVALID,
                    "event version and occurredAt are required");
        }
        AnalyticsPrivacyBoundary.requireOpaqueReference(aggregateType, "aggregateType");
        AnalyticsPrivacyBoundary.requireOpaqueReference(aggregateId, "aggregateId");
        AnalyticsPrivacyBoundary.requireOpaqueReference(actorRef, "actorId");
        AnalyticsPrivacyBoundary.requireOpaqueReference(traceId, "traceId");
        AnalyticsPrivacyBoundary.requireOpaqueReference(requestId, "requestId");
        AnalyticsPrivacyBoundary.requireOpaqueReference(schemaVersion, "schemaVersion");
        AnalyticsPrivacyBoundary.requireOpaqueReference(dedupeKey, "dedupeKey");
        AnalyticsPrivacyBoundary.requireOpaqueReference(sourceService, "sourceService");
        AnalyticsPrivacyBoundary.requireOpaqueReference(tenantId, "tenantId");
        payload = AnalyticsPrivacyBoundary.sanitizePayload(payload);
    }

    /**
     * Parses only the body accepted from a trusted event adapter. Source and tenant are deliberately
     * separate arguments so callers cannot override JWT/workload-derived security facts in JSON.
     */
    public static AnalyticsEventEnvelope fromTrustedMap(Map<?, ?> body, String sourceService, String tenantId) {
        if (body == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.ENVELOPE_INVALID,
                    "event envelope is required");
        }
        for (Object key : body.keySet()) {
            if (!(key instanceof String field) || !BODY_FIELDS.contains(field)) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.ENVELOPE_INVALID,
                        "event envelope contains an unsupported field");
            }
        }
        String eventId = requiredString(body, "eventId");
        String eventName = requiredString(body, "eventName");
        String schema = requiredString(body, "schema");
        int version = requiredInteger(body, "version");
        Instant occurredAt = requiredInstant(body, "occurredAt");
        String aggregateType = requiredString(body, "aggregateType");
        String aggregateId = requiredString(body, "aggregateId");
        String actorId = requiredString(body, "actorId");
        String traceId = requiredString(body, "traceId");
        String requestId = requiredString(body, "requestId");
        String schemaVersion = requiredString(body, "schemaVersion");
        String dedupeKey = requiredString(body, "dedupeKey");
        if (!(body.get("payload") instanceof Map<?, ?> payload)) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.ENVELOPE_INVALID,
                    "payload must be an object");
        }
        return new AnalyticsEventEnvelope(eventId, eventName, schema, version, occurredAt, aggregateType,
                aggregateId, actorId, traceId, requestId, schemaVersion, dedupeKey, sourceService, tenantId,
                stringKeyMap(payload));
    }

    private static String requiredString(Map<?, ?> body, String field) {
        Object value = body.get(field);
        if (!(value instanceof String string) || string.isBlank()) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.ENVELOPE_INVALID,
                    field + " is required");
        }
        return string;
    }

    private static int requiredInteger(Map<?, ?> body, String field) {
        Object value = body.get(field);
        if (!(value instanceof Number number) || number.longValue() < 1 || number.longValue() > Integer.MAX_VALUE) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.ENVELOPE_INVALID,
                    field + " must be a positive integer");
        }
        return number.intValue();
    }

    private static Instant requiredInstant(Map<?, ?> body, String field) {
        String value = requiredString(body, field);
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException exception) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.ENVELOPE_INVALID,
                    field + " must be ISO-8601");
        }
    }

    private static Map<String, Object> stringKeyMap(Map<?, ?> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : source.entrySet()) {
            if (!(entry.getKey() instanceof String key)) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_FIELD_NOT_ALLOWED,
                        "payload contains a non-string field name");
            }
            result.put(key, entry.getValue());
        }
        return result;
    }
}
