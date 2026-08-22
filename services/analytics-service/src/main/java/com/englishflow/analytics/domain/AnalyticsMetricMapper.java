package com.englishflow.analytics.domain;

import java.time.Instant;
import java.util.Map;

/** Converts an allowlisted event into exactly one versioned tenant aggregate delta. */
public final class AnalyticsMetricMapper {

    public MetricDelta toDelta(ValidatedAnalyticsEvent event) {
        AnalyticsEventDefinition definition = event.definition();
        Map<String, Object> payload = event.sanitizedPayload();
        String dimension = definition.dimensionField() == null ? "ALL" : dimension(definition, payload);
        long value = 0L;
        if (definition.valueField() != null) {
            Object raw = payload.get(definition.valueField());
            if (!(raw instanceof Number number)) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                        "metric value field must be numeric");
            }
            value = number.longValue();
            if (value < 0 || value > 1_000_000_000L) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                        "metric value is outside the safe range");
            }
        }
        return new MetricDelta(event.tenant(), definition.metricId(), definition.metricVersion(), dimension,
                1L, value, event.envelope().occurredAt(), AnalyticsHash.sha256(event.envelope().eventId()));
    }

    private static String dimension(AnalyticsEventDefinition definition, Map<String, Object> payload) {
        Object raw = payload.get(definition.dimensionField());
        if (!(raw instanceof String value) || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,95}")) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "metric dimension must be a bounded code");
        }
        return definition.dimensionField() + ":" + value;
    }
}
