package com.englishflow.analytics.domain;

import java.time.LocalDate;

public record MetricProjectionKey(
        TenantScope tenant,
        String metricId,
        String metricVersion,
        LocalDate periodStart,
        String dimensionKey
) {

    public MetricProjectionKey {
        if (tenant == null || periodStart == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "projection key is incomplete");
        }
        AnalyticsPrivacyBoundary.requireOpaqueReference(metricId, "metricId");
        AnalyticsPrivacyBoundary.requireOpaqueReference(metricVersion, "metricVersion");
        AnalyticsPrivacyBoundary.requireOpaqueReference(dimensionKey, "dimensionKey");
    }
}
