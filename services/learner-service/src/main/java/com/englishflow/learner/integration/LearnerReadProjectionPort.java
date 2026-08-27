package com.englishflow.learner.integration;

import java.util.Optional;

/** Learner owner exposes a projection port; consumers do not access learner tables. */
public interface LearnerReadProjectionPort {
    Optional<LearnerReadProjection> findBySubject(String subject, String serverDerivedTenantId);
}
