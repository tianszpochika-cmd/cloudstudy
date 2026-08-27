package com.englishflow.media.adapter.failclosed;

import com.englishflow.media.port.MediaRegistrationIdempotencyPort;

import java.util.Optional;

/** Local-real idempotency boundary; restart-safe storage is mandatory before registration. */
public final class FailClosedMediaRegistrationIdempotencyStore implements MediaRegistrationIdempotencyPort {

    @Override
    public Optional<RegistrationReceipt> find(String tenantId, String subjectId, String idempotencyKey) {
        throw MediaPersistenceNotEnabled.exception();
    }

    @Override
    public void save(String tenantId, String subjectId, String idempotencyKey, RegistrationReceipt receipt) {
        throw MediaPersistenceNotEnabled.exception();
    }
}
