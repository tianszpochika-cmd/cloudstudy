package com.englishflow.social.domain;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Versioned event envelope accepted only from an authenticated, allowlisted producer. The
 * subject and tenant are event facts from the trusted producer, not client identity overrides.
 */
public record TrustedSocialEvent(
        String eventId,
        String traceId,
        String schemaVersion,
        String eventType,
        String sourceService,
        String subjectId,
        String tenantId,
        Instant occurredAt,
        Map<String, Object> payload
) {

    public TrustedSocialEvent {
        require(eventId, "eventId");
        require(traceId, "traceId");
        require(schemaVersion, "schemaVersion");
        require(eventType, "eventType");
        require(sourceService, "sourceService");
        require(subjectId, "subjectId");
        require(tenantId, "tenantId");
        Objects.requireNonNull(occurredAt, "occurredAt");
        payload = payload == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(payload));
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
    }
}
