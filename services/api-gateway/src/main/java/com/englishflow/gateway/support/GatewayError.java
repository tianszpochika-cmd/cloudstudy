package com.englishflow.gateway.support;

public record GatewayError(
        int status,
        String code,
        String message,
        String requestId,
        String traceId,
        boolean retryable
) {

    /**
     * Keeps the existing call sites source-compatible while making the
     * retry contract explicit for every edge error.
     */
    public GatewayError(int status, String code, String message, String requestId, String traceId) {
        this(status, code, message, requestId, traceId, isRetryableStatus(status));
    }

    private static boolean isRetryableStatus(int status) {
        return status == 408 || status == 425 || status == 429 || status >= 500;
    }
}
