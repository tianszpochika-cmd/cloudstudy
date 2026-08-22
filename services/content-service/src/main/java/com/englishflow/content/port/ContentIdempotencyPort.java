package com.englishflow.content.port;

import com.englishflow.content.domain.ContentIdempotencyKey;

import java.util.function.Supplier;

/** Durable uniqueness seam for command retries; Redis is not the content fact source. */
public interface ContentIdempotencyPort {

    <T> T execute(String scope, ContentIdempotencyKey key, String requestFingerprint, Supplier<T> action);
}
