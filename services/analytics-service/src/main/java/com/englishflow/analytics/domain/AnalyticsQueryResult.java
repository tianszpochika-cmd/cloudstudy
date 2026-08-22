package com.englishflow.analytics.domain;

import java.time.Instant;
import java.util.List;

public record AnalyticsQueryResult(
        AnalyticsQueryState state,
        TenantScope tenant,
        String metricVersion,
        List<MetricProjection> rows,
        Instant asOf,
        AnalyticsErrorCode errorCode
) {

    public AnalyticsQueryResult {
        rows = rows == null ? List.of() : List.copyOf(rows);
    }

    public static AnalyticsQueryResult empty(AnalyticsQuery query, String metricVersion, Instant asOf) {
        return new AnalyticsQueryResult(AnalyticsQueryState.EMPTY, query.tenant(), metricVersion, List.of(), asOf, null);
    }
}
