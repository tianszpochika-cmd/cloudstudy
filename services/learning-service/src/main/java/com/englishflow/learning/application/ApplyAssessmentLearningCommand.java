package com.englishflow.learning.application;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningRequestMetadata;
import com.englishflow.learning.port.AssessmentLearningEvent;

public record ApplyAssessmentLearningCommand(
        AssessmentLearningEvent event,
        IdempotencyKey idempotencyKey,
        LearningRequestMetadata metadata) {

    public ApplyAssessmentLearningCommand {
        if (event == null || idempotencyKey == null || metadata == null) {
            throw new IllegalArgumentException("assessment event/idempotency/metadata are required");
        }
    }

    public String fingerprint() {
        return event.eventId() + ":" + event.scope().storageKey() + ":" + event.itemType()
                + ":" + event.itemId() + ":" + event.contentVersionId() + ":" + event.correct()
                + ":" + event.score() + ":" + event.reason() + ":" + event.ruleVersion()
                + ":" + event.verificationStage() + ":" + event.occurredAt();
    }
}
