package com.englishflow.analytics.domain;

public record RecomputeResult(
        RecomputeState state,
        String jobId,
        String metricVersion,
        long replayedEventCount,
        long projectionCount,
        AnalyticsErrorCode reasonCode
) {
}
