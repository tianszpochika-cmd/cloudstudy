package com.englishflow.gateway.support;

public record GatewayError(
        int status,
        String code,
        String message,
        String requestId,
        String traceId
) {
}
