package com.englishflow.commerce.application.ports;

import java.time.Instant;
import java.util.Optional;

public interface IdempotencyPort {
    Optional<Record> find(String tenantId, String subjectId, String operation, String key);
    void save(Record record);

    record Record(String tenantId, String subjectId, String operation, String key,
            String requestFingerprint, Object response, Instant recordedAt) { }
}
