package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.port.ContentIdempotencyPort;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/** Local test double; a production adapter must enforce uniqueness in content-service storage. */
public final class InMemoryContentIdempotency implements ContentIdempotencyPort {

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();

    @Override
    @SuppressWarnings("unchecked")
    public synchronized <T> T execute(
            String scope,
            ContentIdempotencyKey key,
            String requestFingerprint,
            Supplier<T> action) {
        String storageKey = scope + ":" + key.value();
        Entry previous = entries.get(storageKey);
        if (previous != null) {
            if (!previous.fingerprint().equals(requestFingerprint)) {
                throw ContentOperationException.conflict(
                        "IDEMPOTENCY_KEY_REUSE", "Idempotency-Key cannot be reused for another command payload");
            }
            return (T) previous.result();
        }
        T result = action.get();
        entries.put(storageKey, new Entry(requestFingerprint, result));
        return result;
    }

    private record Entry(String fingerprint, Object result) {
    }
}
