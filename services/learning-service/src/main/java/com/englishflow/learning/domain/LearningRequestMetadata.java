package com.englishflow.learning.domain;

/** Required request/trace correlation carried into every learning outbox fact. */
public record LearningRequestMetadata(String requestId, String traceId) {

    public LearningRequestMetadata {
        if (requestId == null || !requestId.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) {
            throw new IllegalArgumentException("requestId is required and has an invalid format");
        }
        if (traceId == null || !traceId.matches("[a-f0-9]{32}")) {
            throw new IllegalArgumentException("traceId is required and must be 32 lowercase hex characters");
        }
    }

    public static LearningRequestMetadata none() {
        return new LearningRequestMetadata(
                "req-learning-local-0001",
                "0123456789abcdef0123456789abcdef");
    }
}
