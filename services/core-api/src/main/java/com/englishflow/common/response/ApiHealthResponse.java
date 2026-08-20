package com.englishflow.common.response;

import java.time.OffsetDateTime;
import java.util.List;

public record ApiHealthResponse(
        String requestId,
        HealthData data,
        ApiMeta meta
) {
    public record HealthData(
            String status,
            String service,
            String version,
            String build,
            List<HealthDependency> dependencies
    ) {
    }

    public record HealthDependency(
            String name,
            String status,
            Integer latencyMs,
            String errorCode
    ) {
    }

    public record ApiMeta(
            String apiVersion,
            String schemaVersion,
            OffsetDateTime serverTime,
            String traceId
    ) {
    }
}
