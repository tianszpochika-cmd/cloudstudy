package com.englishflow.learning.application;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningRequestMetadata;

/** Request DTO at the application boundary; target/content facts are resolved through ports. */
public record CreateLearningPlanCommand(
        long targetId,
        long contentVersionId,
        IdempotencyKey idempotencyKey,
        LearningRequestMetadata metadata) {

    public CreateLearningPlanCommand {
        if (targetId < 1 || contentVersionId < 1) {
            throw new IllegalArgumentException("targetId/contentVersionId must be positive");
        }
        if (idempotencyKey == null || metadata == null) {
            throw new IllegalArgumentException("idempotency and correlation metadata are required");
        }
    }

    public String fingerprint() {
        return targetId + ":" + contentVersionId;
    }
}
