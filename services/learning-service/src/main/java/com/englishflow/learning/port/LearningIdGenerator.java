package com.englishflow.learning.port;

/** Service-local identifier generator; production implementation must be durable/monotonic. */
@FunctionalInterface
public interface LearningIdGenerator {

    long nextId(String aggregateType);
}
