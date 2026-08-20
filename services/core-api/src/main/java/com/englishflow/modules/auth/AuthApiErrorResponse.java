package com.englishflow.modules.auth;

import java.util.Map;

public record AuthApiErrorResponse(
        String requestId,
        String traceId,
        AuthError error
) {
    public record AuthError(
            String errorCode,
            String message,
            boolean retryable,
            Map<String, Object> details
    ) {
    }
}
