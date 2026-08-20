package com.englishflow.modules.user.api;

import java.util.Map;

public record UserErrorResponse(
        String requestId,
        ErrorBody error
) {

    public record ErrorBody(
            String code,
            String message,
            Map<String, Object> details,
            boolean retryable
    ) {
    }
}
