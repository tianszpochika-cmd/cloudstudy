package com.englishflow.notification.port;

/** Value stored inside the service-owned idempotency fact store. */
public record StoredIdempotency(String fingerprint, Object value) {

    public StoredIdempotency {
        if (fingerprint == null || fingerprint.isBlank() || value == null) {
            throw new IllegalArgumentException("idempotency record is incomplete");
        }
    }
}
