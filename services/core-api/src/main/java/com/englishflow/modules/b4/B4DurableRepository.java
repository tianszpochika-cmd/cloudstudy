package com.englishflow.modules.b4;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Durable boundary for B4 facts. MySQL is the production source of truth;
 * the memory adapter exists only for local development and unit tests.
 */
public interface B4DurableRepository {
    record Fact(String aggregateType, String aggregateId, long userId,
                String requestId, String idempotencyKey, Instant occurredAt,
                Map<String, Object> payload) {}

    void append(Fact fact);

    List<Fact> list(String aggregateType, long userId);
}
