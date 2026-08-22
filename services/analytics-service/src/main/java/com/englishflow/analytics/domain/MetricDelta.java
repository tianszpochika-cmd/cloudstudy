package com.englishflow.analytics.domain;

import java.time.Instant;

/** One tenant-safe aggregate delta produced by a registered metric definition. */
public record MetricDelta(
        TenantScope tenant,
        String metricId,
        String metricVersion,
        String dimensionKey,
        long eventCount,
        long totalValue,
        Instant occurredAt,
        String sourceWatermark
) {

    public MetricDelta {
        if (eventCount < 0 || totalValue < 0) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "metric delta cannot be negative");
        }
        AnalyticsPrivacyBoundary.requireOpaqueReference(metricId, "metricId");
        AnalyticsPrivacyBoundary.requireOpaqueReference(metricVersion, "metricVersion");
        AnalyticsPrivacyBoundary.requireOpaqueReference(dimensionKey, "dimensionKey");
        AnalyticsPrivacyBoundary.requireOpaqueReference(sourceWatermark, "sourceWatermark");
        if (occurredAt == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "metric occurredAt is required");
        }
    }
}
