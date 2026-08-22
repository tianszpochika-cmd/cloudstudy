package com.englishflow.learning.application;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningRequestMetadata;

public record CompleteLearningTaskCommand(
        long planId,
        long taskId,
        long expectedPlanVersion,
        IdempotencyKey idempotencyKey,
        LearningRequestMetadata metadata) {

    public CompleteLearningTaskCommand {
        if (planId < 1 || taskId < 1 || expectedPlanVersion < 1
                || idempotencyKey == null || metadata == null) {
            throw new IllegalArgumentException("task command fields are required");
        }
    }

    public String fingerprint() {
        return planId + ":" + taskId + ":" + expectedPlanVersion;
    }
}
