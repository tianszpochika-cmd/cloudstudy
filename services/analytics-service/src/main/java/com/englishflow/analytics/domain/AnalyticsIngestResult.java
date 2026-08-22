package com.englishflow.analytics.domain;

import java.util.List;

public record AnalyticsIngestResult(
        AnalyticsIngestState state,
        String eventId,
        String dedupeKey,
        String metricVersion,
        List<String> projectionKeys,
        AnalyticsErrorCode reasonCode
) {

    public AnalyticsIngestResult {
        projectionKeys = projectionKeys == null ? List.of() : List.copyOf(projectionKeys);
    }

    public static AnalyticsIngestResult rejected(String eventId, String dedupeKey, AnalyticsErrorCode code) {
        return new AnalyticsIngestResult(AnalyticsIngestState.REJECTED, eventId, dedupeKey, null, List.of(), code);
    }
}
