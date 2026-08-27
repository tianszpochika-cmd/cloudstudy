package com.englishflow.media.port;

import java.util.Optional;

/**
 * Durable boundary for registration idempotency. Local-real must provide a non-memory
 * implementation so a process restart cannot change the meaning of an Idempotency-Key.
 */
public interface MediaRegistrationIdempotencyPort {

    Optional<RegistrationReceipt> find(String tenantId, String subjectId, String idempotencyKey);

    void save(String tenantId, String subjectId, String idempotencyKey, RegistrationReceipt receipt);

    record RegistrationReceipt(String fingerprint, String assetId) {
    }
}
