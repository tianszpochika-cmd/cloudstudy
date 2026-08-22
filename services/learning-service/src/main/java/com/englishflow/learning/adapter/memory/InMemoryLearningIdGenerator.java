package com.englishflow.learning.adapter.memory;

import com.englishflow.learning.port.LearningIdGenerator;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** Deterministic fixture adapter; it is not a production id generator. */
public final class InMemoryLearningIdGenerator implements LearningIdGenerator {

    private final Map<String, AtomicLong> sequences = new ConcurrentHashMap<>();

    @Override
    public long nextId(String aggregateType) {
        if (aggregateType == null || !aggregateType.matches("[a-z][a-z0-9_]{1,63}")) {
            throw new IllegalArgumentException("aggregateType is invalid");
        }
        return sequences.computeIfAbsent(aggregateType, ignored -> new AtomicLong(seed(aggregateType)))
                .getAndIncrement();
    }

    private static long seed(String aggregateType) {
        return switch (aggregateType) {
            case "learning_plan" -> 1000L;
            case "learning_task" -> 2000L;
            case "srs_state" -> 3000L;
            case "review_event" -> 4000L;
            case "schedule_snapshot" -> 5000L;
            default -> 9000L;
        };
    }
}
