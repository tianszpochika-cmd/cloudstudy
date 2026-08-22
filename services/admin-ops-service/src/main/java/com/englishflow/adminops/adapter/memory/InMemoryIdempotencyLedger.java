package com.englishflow.adminops.adapter.memory;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.IdempotencyLedger;

/** Test/development adapter; production replaces this with a service-owned idempotency table. */
public final class InMemoryIdempotencyLedger implements IdempotencyLedger {

    private final Map<String, Entry> entries = new HashMap<>();

    @Override
    public synchronized Optional<Entry> find(String scope, String key) {
        return Optional.ofNullable(entries.get(scope + "|" + key));
    }

    @Override
    public synchronized void put(String scope, String key, String fingerprint, Object result) {
        String storageKey = scope + "|" + key;
        Entry prior = entries.get(storageKey);
        if (prior != null && !prior.fingerprint().equals(fingerprint)) {
            throw AdminOpsException.conflict("ADMIN_IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was reused for another command");
        }
        entries.putIfAbsent(storageKey, new Entry(fingerprint, result));
    }
}
