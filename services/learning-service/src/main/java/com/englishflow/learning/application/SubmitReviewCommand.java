package com.englishflow.learning.application;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningRequestMetadata;
import com.englishflow.learning.domain.ReviewConfidence;

import java.time.Instant;

public record SubmitReviewCommand(
        long targetId,
        LearningItemType itemType,
        long itemId,
        long contentVersionId,
        int rawQuality,
        ReviewConfidence confidence,
        Instant reviewedAt,
        int expectedStateVersion,
        IdempotencyKey idempotencyKey,
        LearningRequestMetadata metadata) {

    public SubmitReviewCommand {
        if (targetId < 1 || itemType == null || !itemType.srsEligible() || itemId < 1 || contentVersionId < 1
                || rawQuality < 0 || rawQuality > 3 || confidence == null || reviewedAt == null
                || expectedStateVersion < 0 || idempotencyKey == null || metadata == null) {
            throw new IllegalArgumentException("review command is invalid");
        }
    }

    public String fingerprint() {
        return targetId + ":" + itemType + ":" + itemId + ":" + contentVersionId + ":" + rawQuality + ":" + confidence + ":" + reviewedAt;
    }
}
