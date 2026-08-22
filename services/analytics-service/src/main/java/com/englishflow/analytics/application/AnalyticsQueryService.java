package com.englishflow.analytics.application;

import com.englishflow.analytics.domain.AnalyticsErrorCode;
import com.englishflow.analytics.domain.AnalyticsMetricVersions;
import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.domain.AnalyticsQueryResult;
import com.englishflow.analytics.domain.AnalyticsQueryState;
import com.englishflow.analytics.port.AnalyticsProjectionStore;
import com.englishflow.analytics.port.AnalyticsQueryPort;
import java.time.Instant;
import java.util.List;

/** Query application service that never broadens a caller's tenant scope. */
public final class AnalyticsQueryService implements AnalyticsQueryPort {

    private final AnalyticsProjectionStore store;

    public AnalyticsQueryService(AnalyticsProjectionStore store) {
        this.store = store;
    }

    @Override
    public AnalyticsQueryResult query(AnalyticsQuery query) {
        if (query.metricVersion() != null && !AnalyticsMetricVersions.isSupported(query.metricVersion())) {
            return new AnalyticsQueryResult(AnalyticsQueryState.ERROR, query.tenant(), query.metricVersion(),
                    List.of(), Instant.now(), AnalyticsErrorCode.METRIC_VERSION_UNSUPPORTED);
        }
        try {
            List<com.englishflow.analytics.domain.MetricProjection> rows = store.query(query);
            if (rows.isEmpty()) {
                return AnalyticsQueryResult.empty(query,
                        query.metricVersion() == null ? AnalyticsMetricVersions.ALL_CURRENT : query.metricVersion(),
                        Instant.now());
            }
            return new AnalyticsQueryResult(AnalyticsQueryState.READY, query.tenant(),
                    query.metricVersion() == null ? AnalyticsMetricVersions.ALL_CURRENT : query.metricVersion(),
                    rows, Instant.now(), null);
        } catch (RuntimeException exception) {
            return new AnalyticsQueryResult(AnalyticsQueryState.ERROR, query.tenant(), query.metricVersion(),
                    List.of(), Instant.now(), AnalyticsErrorCode.PROJECTION_READ_FAILED);
        }
    }
}
