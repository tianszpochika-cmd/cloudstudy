package com.englishflow.learning.adapter.failclosed;

import com.englishflow.learning.port.LearningIdGenerator;

/** No identifier generation is allowed when the durable/fixture mode has not been selected. */
public final class FailClosedLearningIdGenerator implements LearningIdGenerator {

    @Override
    public long nextId(String aggregateType) {
        throw new LearningPersistenceUnavailableException(
                "learning identifiers are unavailable while persistence is fail-closed");
    }
}
