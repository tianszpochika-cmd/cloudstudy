package com.englishflow.adminops.domain;

import java.util.Optional;

/** Shared command idempotency port; the production adapter can use a service-owned table. */
public interface IdempotencyLedger {

    Optional<Entry> find(String scope, String key);

    void put(String scope, String key, String fingerprint, Object result);

    record Entry(String fingerprint, Object result) {
    }
}
