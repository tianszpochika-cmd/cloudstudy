package com.englishflow.analytics.domain;

import java.util.Map;
import java.util.Set;

/** One versioned, source-owned event shape accepted by the analytics worker. */
public record AnalyticsEventDefinition(
        String eventName,
        String schema,
        int version,
        String aggregateType,
        String aggregateIdField,
        String sourceService,
        String metricId,
        String metricVersion,
        Set<String> requiredPayloadFields,
        Set<String> allowedPayloadFields,
        String dimensionField,
        String valueField,
        Map<String, Set<String>> enumFields,
        Set<String> nullablePayloadFields
) {

    public AnalyticsEventDefinition {
        requiredPayloadFields = Set.copyOf(requiredPayloadFields);
        allowedPayloadFields = Set.copyOf(allowedPayloadFields);
        enumFields = enumFields == null ? Map.of() : enumFields.entrySet().stream()
                .collect(java.util.stream.Collectors.toUnmodifiableMap(Map.Entry::getKey, entry -> Set.copyOf(entry.getValue())));
        nullablePayloadFields = nullablePayloadFields == null ? Set.of() : Set.copyOf(nullablePayloadFields);
    }
}
