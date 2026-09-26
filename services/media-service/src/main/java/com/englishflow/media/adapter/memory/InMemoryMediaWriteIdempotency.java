package com.englishflow.media.adapter.memory;

import com.englishflow.media.application.MediaWriteFingerprint;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.port.MediaWriteIdempotencyPort;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Supplier;

/** Local fixture only; local-real uses the transactional JDBC owner store. */
public final class InMemoryMediaWriteIdempotency implements MediaWriteIdempotencyPort {

    private final ConcurrentMap<String, Receipt> receipts = new ConcurrentHashMap<>();

    @Override
    public Map<String, Object> execute(String operation, String assetId, Object request,
            MediaAuthorizationContext context, String idempotencyKey,
            Runnable authorize, Supplier<Map<String, Object>> command) {
        String key = MediaWriteFingerprint.key(idempotencyKey);
        String scope = context.tenantId() + "\0" + context.subjectId() + "\0" + operation + "\0" + key;
        String fingerprint = MediaWriteFingerprint.digest(assetId, request);
        synchronized (receipts) {
            authorize.run();
            Receipt existing = receipts.get(scope);
            if (existing != null) {
                if (!existing.fingerprint().equals(fingerprint)) {
                    throw MediaOperationException.conflict(
                            "MEDIA_IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used for another media request");
                }
                return existing.response();
            }
            Map<String, Object> response = Map.copyOf(command.get());
            receipts.put(scope, new Receipt(fingerprint, response));
            return response;
        }
    }

    private record Receipt(String fingerprint, Map<String, Object> response) {}
}
