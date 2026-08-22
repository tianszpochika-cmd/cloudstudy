package com.englishflow.analytics.domain;

import java.time.Instant;
import java.util.Map;

/** Replay journal entry. It omits actor identity and holds only allowlisted sanitized fields. */
public record SanitizedAnalyticsEvent(
        TenantScope tenant,
        String eventId,
        String eventName,
        String schemaVersion,
        String dedupeKey,
        String payloadHash,
        Instant occurredAt,
        Map<String, Object> payload
) {

    public SanitizedAnalyticsEvent {
        if (tenant == null || occurredAt == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "journal entry is incomplete");
        }
        AnalyticsPrivacyBoundary.requireOpaqueReference(eventId, "eventId");
        AnalyticsPrivacyBoundary.requireOpaqueReference(eventName, "eventName");
        AnalyticsPrivacyBoundary.requireOpaqueReference(schemaVersion, "schemaVersion");
        AnalyticsPrivacyBoundary.requireOpaqueReference(dedupeKey, "dedupeKey");
        AnalyticsPrivacyBoundary.requireOpaqueReference(payloadHash, "payloadHash");
        payload = AnalyticsPrivacyBoundary.sanitizePayload(payload);
    }
}
