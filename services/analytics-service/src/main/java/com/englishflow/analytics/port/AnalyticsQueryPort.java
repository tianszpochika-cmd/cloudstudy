package com.englishflow.analytics.port;

import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.domain.AnalyticsQueryResult;

/** Query seam for admin/operations projections; tenant scope is not client-selectable. */
public interface AnalyticsQueryPort {

    AnalyticsQueryResult query(AnalyticsQuery query);
}
