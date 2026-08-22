package com.englishflow.learning.application;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningRequestMetadata;

public record RecordProgressCommand(
        long planId,
        long taskId,
        int totalUnits,
        int completedUnits,
        long addedStudySeconds,
        long expectedVersion,
        IdempotencyKey idempotencyKey,
        LearningRequestMetadata metadata) {

    public RecordProgressCommand {
        if (planId < 1 || taskId < 1 || totalUnits < 1 || completedUnits < 0
                || completedUnits > totalUnits || addedStudySeconds < 0 || expectedVersion < 0
                || idempotencyKey == null || metadata == null) {
            throw new IllegalArgumentException("progress command is invalid");
        }
    }

    public String fingerprint() {
        return planId + ":" + taskId + ":" + totalUnits + ":" + completedUnits + ":" + addedStudySeconds + ":" + expectedVersion;
    }
}
