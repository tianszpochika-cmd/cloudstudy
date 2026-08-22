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

    /**
     * Lists all facts for an aggregate type.  The B4 migration currently uses
     * one append-only fact table, so projections can be rebuilt without making
     * Redis the source of truth.  Adapters that cannot provide this query may
     * return an empty list; request-time writes still remain durable.
     */
    default List<Fact> listAll(String aggregateType) {
        return List.of();
    }

    default List<Fact> listByAggregate(String aggregateType, String aggregateId) {
        return listAll(aggregateType).stream()
                .filter(fact -> aggregateId.equals(fact.aggregateId()))
                .toList();
    }
}
