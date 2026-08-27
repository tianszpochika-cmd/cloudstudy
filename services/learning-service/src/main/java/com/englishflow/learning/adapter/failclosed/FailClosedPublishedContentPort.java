package com.englishflow.learning.adapter.failclosed;

import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.port.PublishedContentPort;

import java.util.Optional;

/** Cross-service content facts are never fabricated when no connector/fixture is configured. */
public final class FailClosedPublishedContentPort implements PublishedContentPort {

    @Override
    public Optional<PublishedContentSnapshot> findLearnerSnapshot(
            LearningPrincipalContext principal, long contentVersionId) {
        throw new LearningPersistenceUnavailableException(
                "published content read port is not configured; no content fixture is exposed");
    }
}
