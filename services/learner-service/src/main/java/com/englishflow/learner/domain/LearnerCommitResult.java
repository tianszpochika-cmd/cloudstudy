package com.englishflow.learner.domain;

import java.util.Objects;

/** Result of an atomic learner-owned commit, including whether it was an idempotent replay. */
public record LearnerCommitResult(LearnerProfile profile, boolean replayed) {

    public LearnerCommitResult {
        Objects.requireNonNull(profile, "profile is required");
    }
}
