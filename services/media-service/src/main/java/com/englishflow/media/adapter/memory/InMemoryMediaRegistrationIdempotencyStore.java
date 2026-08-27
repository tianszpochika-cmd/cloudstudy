package com.englishflow.media.adapter.memory;

import com.englishflow.media.port.MediaRegistrationIdempotencyPort;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/** Test-only idempotency fixture; it is never wired by the local-real profile. */
public final class InMemoryMediaRegistrationIdempotencyStore implements MediaRegistrationIdempotencyPort {

    private final ConcurrentMap<String, RegistrationReceipt> receipts = new ConcurrentHashMap<>();

    @Override
    public Optional<RegistrationReceipt> find(String tenantId, String subjectId, String idempotencyKey) {
        return Optional.ofNullable(receipts.get(key(tenantId, subjectId, idempotencyKey)));
    }

    @Override
    public void save(String tenantId, String subjectId, String idempotencyKey, RegistrationReceipt receipt) {
        receipts.put(key(tenantId, subjectId, idempotencyKey), receipt);
    }

    private static String key(String tenantId, String subjectId, String idempotencyKey) {
        return tenantId + "\u0000" + subjectId + "\u0000" + idempotencyKey;
    }
}
