package com.englishflow.modules.user.api;

import java.time.Instant;

/** Minimal response envelope matching the user-domain contract fragment. */
public record UserApiEnvelope<T>(
        String requestId,
        T data,
        Meta meta
) {

    public static <T> UserApiEnvelope<T> of(String requestId, T data, Long version) {
        return new UserApiEnvelope<>(
                requestId,
                data,
                new Meta(Instant.now(), version, null, false)
        );
    }

    public static <T> UserApiEnvelope<T> page(
            String requestId,
            T data,
            String nextCursor,
            boolean hasMore
    ) {
        return new UserApiEnvelope<>(
                requestId,
                data,
                new Meta(Instant.now(), null, nextCursor, hasMore)
        );
    }

    public record Meta(
            Instant serverTime,
            Long version,
            String nextCursor,
            boolean hasMore
    ) {
    }
}
