package com.englishflow.learning.application;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningRequestMetadata;

import java.time.LocalDate;

public record BuildReviewQueueCommand(
        long targetId,
        LocalDate localDate,
        int limit,
        IdempotencyKey idempotencyKey,
        LearningRequestMetadata metadata) {

    public BuildReviewQueueCommand {
        if (targetId < 1 || localDate == null
                || limit < 1 || limit > 200 || idempotencyKey == null || metadata == null) {
            throw new IllegalArgumentException("queue target/date/limit/idempotency/metadata are required");
        }
    }

    public String fingerprint() {
        return targetId + ":" + localDate + ":" + limit;
    }
}
