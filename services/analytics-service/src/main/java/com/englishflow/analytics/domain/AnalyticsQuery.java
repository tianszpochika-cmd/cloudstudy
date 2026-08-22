package com.englishflow.analytics.domain;

import java.time.LocalDate;
import java.util.List;

public record AnalyticsQuery(
        TenantScope tenant,
        List<String> metricIds,
        LocalDate from,
        LocalDate to,
        String metricVersion
) {

    public AnalyticsQuery {
        if (tenant == null || from == null || to == null || to.isBefore(from)) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RECOMPUTE_RANGE_INVALID,
                    "analytics query date range is invalid");
        }
        metricIds = metricIds == null ? List.of() : List.copyOf(metricIds);
        metricIds.forEach(metricId -> AnalyticsPrivacyBoundary.requireOpaqueReference(metricId, "metricId"));
        if (metricVersion != null) {
            AnalyticsPrivacyBoundary.requireOpaqueReference(metricVersion, "metricVersion");
        }
    }
}
