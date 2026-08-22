package com.englishflow.commerce.adapter.memory;

import com.englishflow.commerce.application.ports.IdempotencyPort;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public final class InMemoryIdempotencyPort implements IdempotencyPort {
    private final ConcurrentMap<String, Record> records = new ConcurrentHashMap<>();

    @Override public Optional<Record> find(String tenantId, String subjectId, String operation, String key) {
        return Optional.ofNullable(records.get(compose(tenantId, subjectId, operation, key)));
    }

    @Override public void save(Record record) {
        records.putIfAbsent(compose(record.tenantId(), record.subjectId(), record.operation(), record.key()), record);
    }

    private static String compose(String tenantId, String subjectId, String operation, String key) {
        return tenantId + "\u001f" + subjectId + "\u001f" + operation + "\u001f" + key;
    }
}
