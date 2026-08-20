package com.englishflow.modules.onboarding;

import java.time.Instant;

public record B1ApiError(
        String errorCode,
        String message,
        boolean retryable,
        Instant occurredAt
) {
}
