package com.englishflow.learner.port;

import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.domain.LegacyLearnerSnapshot;

import java.util.Optional;

/** Read-only v1 shadow seam. It intentionally exposes no mutation operation. */
@FunctionalInterface
public interface LegacyLearnerReadModelPort {

    Optional<LegacyLearnerSnapshot> find(LearnerTenantScope scope);
}
