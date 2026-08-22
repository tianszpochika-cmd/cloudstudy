package com.englishflow.learning.domain;

import java.util.Objects;

/** Unique learner-owned plan identity: one target pinned to one published content version/epoch. */
public record PlanningKey(
        LearningTenantScope scope,
        long targetId,
        long contentVersionId,
        long contentEpoch) {

    public PlanningKey {
        Objects.requireNonNull(scope, "scope is required");
        if (targetId < 1 || contentVersionId < 1 || contentEpoch < 1) {
            throw new IllegalArgumentException("planning identifiers must be positive");
        }
    }

    public String storageKey() {
        return scope.storageKey() + ":" + targetId + ":" + contentVersionId + ":" + contentEpoch;
    }
}
