package com.englishflow.analytics.domain;

import java.time.Instant;
import java.time.LocalDate;

/** Durable projection shape. It contains only aggregate numbers and opaque watermarks. */
public record MetricProjection(
        MetricProjectionKey key,
        ProjectionState state,
        long eventCount,
        long totalValue,
        Instant lastOccurredAt,
        String sourceWatermark,
        long projectionVersion,
        AnalyticsErrorCode errorCode,
        Instant updatedAt
) {

    public MetricProjection {
        if (key == null || state == null || eventCount < 0 || totalValue < 0 || projectionVersion < 0
                || updatedAt == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "projection is invalid");
        }
        if (state == ProjectionState.ERROR && errorCode == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "error projection requires an error code");
        }
        if (sourceWatermark != null) {
            AnalyticsPrivacyBoundary.requireOpaqueReference(sourceWatermark, "sourceWatermark");
        }
    }

    public static MetricProjection empty(MetricProjectionKey key, Instant now) {
        return new MetricProjection(key, ProjectionState.EMPTY, 0L, 0L, null, null, 0L, null, now);
    }

    public MetricProjection apply(MetricDelta delta, Instant now) {
        if (!key.tenant().equals(delta.tenant()) || !key.metricId().equals(delta.metricId())
                || !key.metricVersion().equals(delta.metricVersion()) || !key.dimensionKey().equals(delta.dimensionKey())) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "metric delta does not match projection");
        }
        try {
            return new MetricProjection(key, ProjectionState.READY,
                    Math.addExact(eventCount, delta.eventCount()),
                    Math.addExact(totalValue, delta.totalValue()),
                    lastOccurredAt == null || delta.occurredAt().isAfter(lastOccurredAt)
                            ? delta.occurredAt() : lastOccurredAt,
                    delta.sourceWatermark(), projectionVersion + 1L, null, now);
        } catch (ArithmeticException exception) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "metric projection overflow");
        }
    }

    public MetricProjection error(AnalyticsErrorCode code, Instant now) {
        return new MetricProjection(key, ProjectionState.ERROR, eventCount, totalValue, lastOccurredAt,
                sourceWatermark, projectionVersion + 1L, code, now);
    }

    public LocalDate periodStart() {
        return key.periodStart();
    }
}
