package com.englishflow.content.port;

import com.englishflow.content.domain.ContentIdempotencyKey;

import java.util.function.Supplier;
import java.util.Map;

/** Durable uniqueness seam for command retries; Redis is not the content fact source. */
public interface ContentIdempotencyPort {

    <T> T execute(String scope, ContentIdempotencyKey key, String requestFingerprint, Supplier<T> action);

    /** JSON-object command receipts can be replayed from durable storage across processes. */
    default Map<String, Object> executeMap(
            String scope, ContentIdempotencyKey key, String requestFingerprint,
            Supplier<Map<String, Object>> action) {
        return execute(scope, key, requestFingerprint, action);
    }
}
