package com.englishflow.modules.auth;

import java.time.OffsetDateTime;

public record AuthApiResponse<T>(
        String requestId,
        T data,
        ApiMeta meta
) {
    public record ApiMeta(
            String apiVersion,
            String schemaVersion,
            OffsetDateTime serverTime,
            String traceId
    ) {
    }
}
