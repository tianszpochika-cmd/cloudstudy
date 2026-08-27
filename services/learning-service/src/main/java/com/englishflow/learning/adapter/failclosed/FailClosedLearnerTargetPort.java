package com.englishflow.learning.adapter.failclosed;

import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.port.LearnerTargetPort;

import java.util.Optional;

/** Cross-service learner facts are never fabricated when no connector/fixture is configured. */
public final class FailClosedLearnerTargetPort implements LearnerTargetPort {

    @Override
    public Optional<LearnerTargetSnapshot> findTarget(LearningPrincipalContext principal, long targetId) {
        throw new LearningPersistenceUnavailableException(
                "learner target read port is not configured; no target fixture is exposed");
    }
}
