package com.englishflow.learning.application;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningRequestMetadata;

public record ResumeLearningPlanCommand(
        long planId,
        long expectedPlanVersion,
        IdempotencyKey idempotencyKey,
        LearningRequestMetadata metadata) {

    public ResumeLearningPlanCommand {
        if (planId < 1 || expectedPlanVersion < 1 || idempotencyKey == null || metadata == null) {
            throw new IllegalArgumentException("plan/version/idempotency/metadata are required");
        }
    }

    public String fingerprint() {
        return planId + ":" + expectedPlanVersion;
    }
}
