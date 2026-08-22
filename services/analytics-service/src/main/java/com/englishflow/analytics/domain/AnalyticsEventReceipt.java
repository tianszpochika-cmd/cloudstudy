package com.englishflow.analytics.domain;

import java.time.Instant;

/** Dedupe fact owned by analytics-service; it does not replace a producer's domain fact. */
public record AnalyticsEventReceipt(
        TenantScope tenant,
        String eventId,
        String eventName,
        String dedupeKey,
        String payloadHash,
        String metricVersion,
        EventReceiptState state,
        AnalyticsErrorCode reasonCode,
        Instant receivedAt
) {

    public AnalyticsEventReceipt {
        if (tenant == null || state == null || receivedAt == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "event receipt is incomplete");
        }
        AnalyticsPrivacyBoundary.requireOpaqueReference(eventId, "eventId");
        AnalyticsPrivacyBoundary.requireOpaqueReference(eventName, "eventName");
        AnalyticsPrivacyBoundary.requireOpaqueReference(dedupeKey, "dedupeKey");
        AnalyticsPrivacyBoundary.requireOpaqueReference(payloadHash, "payloadHash");
        AnalyticsPrivacyBoundary.requireOpaqueReference(metricVersion, "metricVersion");
    }
}
