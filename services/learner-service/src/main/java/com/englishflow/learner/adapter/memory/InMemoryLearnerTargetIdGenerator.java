package com.englishflow.learner.adapter.memory;

import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.port.LearnerTargetIdGenerator;

import java.util.concurrent.atomic.AtomicLong;

/** Local/domain-test replacement for the learner-owned BIGINT target sequence. */
public final class InMemoryLearnerTargetIdGenerator implements LearnerTargetIdGenerator {

    private final AtomicLong sequence = new AtomicLong(1000L);

    @Override
    public long nextId(LearnerTenantScope scope) {
        if (scope == null) {
            throw new IllegalArgumentException("scope is required");
        }
        return sequence.incrementAndGet();
    }
}
