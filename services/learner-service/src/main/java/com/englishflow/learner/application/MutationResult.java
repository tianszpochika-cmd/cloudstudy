package com.englishflow.learner.application;

import java.util.Objects;

/** Uniform write result for future OpenAPI generation. */
public record MutationResult<T>(
        T data,
        boolean replayed,
        long version,
        String requestId,
        String traceId) {

    public MutationResult {
        Objects.requireNonNull(data, "data is required");
    }
}
