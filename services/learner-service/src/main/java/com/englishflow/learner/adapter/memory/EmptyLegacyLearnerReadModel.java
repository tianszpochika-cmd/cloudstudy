package com.englishflow.learner.adapter.memory;

import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.port.LegacyLearnerReadModelPort;

import java.util.Optional;

/** Explicit no-legacy-data adapter for new users and isolated unit tests. */
public final class EmptyLegacyLearnerReadModel implements LegacyLearnerReadModelPort {

    @Override
    public Optional<com.englishflow.learner.domain.LegacyLearnerSnapshot> find(LearnerTenantScope scope) {
        return Optional.empty();
    }
}
