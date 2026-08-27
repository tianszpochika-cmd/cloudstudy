package com.englishflow.learner.adapter.failclosed;

import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.port.LearnerTargetIdGenerator;

/** Prevents a disabled runtime from inventing target ids in memory. */
public final class FailClosedLearnerTargetIdGenerator implements LearnerTargetIdGenerator {

    @Override
    public long nextId(LearnerTenantScope scope) {
        throw new LearnerDomainException(LearnerDecisionCode.STORE_FAILURE,
                "learner persistence is disabled; target ids cannot be allocated", true);
    }
}
