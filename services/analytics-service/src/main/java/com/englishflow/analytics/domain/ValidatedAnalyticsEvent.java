package com.englishflow.analytics.domain;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** Event after allowlist, schema, privacy and tenant checks. Actor identity is intentionally absent. */
public record ValidatedAnalyticsEvent(
        AnalyticsEventEnvelope envelope,
        AnalyticsEventDefinition definition,
        Map<String, Object> sanitizedPayload,
        String payloadHash
) {

    public ValidatedAnalyticsEvent {
        if (sanitizedPayload == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "sanitized payload must be present");
        }
        sanitizedPayload = Collections.unmodifiableMap(new LinkedHashMap<>(sanitizedPayload));
    }

    public TenantScope tenant() {
        return new TenantScope(envelope.tenantId());
    }
}
