package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.port.ContentIdempotencyPort;

import java.util.function.Supplier;

/** Command retries cannot execute without a durable idempotency owner. */
public final class FailClosedContentIdempotency implements ContentIdempotencyPort {

    @Override
    public <T> T execute(
            String scope,
            ContentIdempotencyKey key,
            String requestFingerprint,
            Supplier<T> action) {
        throw ContentPersistenceFailure.unavailable();
    }
}
