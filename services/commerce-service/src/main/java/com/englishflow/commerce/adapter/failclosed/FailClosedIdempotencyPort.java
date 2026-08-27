package com.englishflow.commerce.adapter.failclosed;

import com.englishflow.commerce.application.ports.IdempotencyPort;
import com.englishflow.commerce.domain.CommerceException;
import java.util.Optional;

/** No local-real write may proceed without a durable idempotency claim. */
public final class FailClosedIdempotencyPort implements IdempotencyPort {
    @Override public Optional<Record> find(String tenantId, String subjectId, String operation, String key) {
        throw CommerceException.unavailable("COMMERCE_IDEMPOTENCY_UNAVAILABLE", "durable idempotency is not configured");
    }

    @Override public void save(Record record) {
        throw CommerceException.unavailable("COMMERCE_IDEMPOTENCY_UNAVAILABLE", "durable idempotency is not configured");
    }
}
