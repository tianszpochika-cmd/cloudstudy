package com.englishflow.learning.domain;

import java.time.Instant;
import java.util.Objects;

/** Monotonic progress fact owned by learning-service and keyed by plan/task/owner. */
public record LearningProgress(
        LearningTenantScope scope,
        long planId,
        long taskId,
        int completedUnits,
        int totalUnits,
        long studySeconds,
        long version,
        Instant lastActivityAt) {

    public LearningProgress {
        Objects.requireNonNull(scope, "scope is required");
        if (planId < 1 || taskId < 1 || completedUnits < 0 || totalUnits < 1
                || completedUnits > totalUnits || studySeconds < 0 || version < 0) {
            throw new IllegalArgumentException("progress values are invalid");
        }
        Objects.requireNonNull(lastActivityAt, "lastActivityAt is required");
    }

    public static LearningProgress empty(LearningTenantScope scope, long planId, long taskId,
            int totalUnits, Instant now) {
        return new LearningProgress(scope, planId, taskId, 0, totalUnits, 0, 0, now);
    }

    public LearningProgress advance(int nextCompletedUnits, long addedStudySeconds,
            long expectedVersion, Instant now) {
        if (expectedVersion != version) {
            throw new LearningDomainException(LearningDecisionCode.VERSION_CONFLICT,
                    "progress expected version does not match");
        }
        if (nextCompletedUnits < completedUnits || nextCompletedUnits > totalUnits
                || addedStudySeconds < 0) {
            throw new LearningDomainException(LearningDecisionCode.PROGRESS_INVALID,
                    "progress must be monotonic and bounded");
        }
        return new LearningProgress(scope, planId, taskId, nextCompletedUnits, totalUnits,
                studySeconds + addedStudySeconds, version + 1, now);
    }

    public int percent() {
        return Math.min(100, (int) Math.round(completedUnits * 100d / totalUnits));
    }
}
