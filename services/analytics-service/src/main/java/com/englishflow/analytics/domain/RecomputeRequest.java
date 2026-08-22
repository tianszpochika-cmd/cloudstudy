package com.englishflow.analytics.domain;

import java.time.LocalDate;

public record RecomputeRequest(
        TenantScope tenant,
        String metricVersion,
        LocalDate from,
        LocalDate to,
        String jobId
) {

    public RecomputeRequest {
        if (tenant == null || from == null || to == null || to.isBefore(from)) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RECOMPUTE_RANGE_INVALID,
                    "recompute date range is invalid");
        }
        AnalyticsPrivacyBoundary.requireOpaqueReference(metricVersion, "metricVersion");
        AnalyticsPrivacyBoundary.requireOpaqueReference(jobId, "jobId");
    }
}
