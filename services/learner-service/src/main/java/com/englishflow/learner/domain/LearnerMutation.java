package com.englishflow.learner.domain;

import java.util.Objects;

/** Atomic write envelope for the learner-owned profile/idempotency/outbox boundary. */
public record LearnerMutation(
        LearnerTenantScope scope,
        long expectedVersion,
        LearnerProfile updatedProfile,
        IdempotencyRecord idempotencyRecord,
        LearnerOutboxEvent outboxEvent) {

    public LearnerMutation {
        Objects.requireNonNull(scope, "scope is required");
        if (expectedVersion < -1) {
            throw new LearnerDomainException(LearnerDecisionCode.CONCURRENT_UPDATE,
                    "expected version must be -1 or greater", true);
        }
        Objects.requireNonNull(updatedProfile, "updatedProfile is required");
        if (!scope.equals(updatedProfile.scope())) {
            throw new LearnerDomainException(LearnerDecisionCode.TENANT_MISMATCH,
                    "updated profile is outside the verified scope");
        }
        if (updatedProfile.version() != expectedVersion + 1) {
            throw new LearnerDomainException(LearnerDecisionCode.CONCURRENT_UPDATE,
                    "updated profile version does not follow the expected version", true);
        }
        Objects.requireNonNull(idempotencyRecord, "idempotencyRecord is required");
        if (!scope.equals(idempotencyRecord.scope())) {
            throw new LearnerDomainException(LearnerDecisionCode.TENANT_MISMATCH,
                    "idempotency record is outside the verified scope");
        }
        Objects.requireNonNull(outboxEvent, "outboxEvent is required");
        if (!scope.equals(outboxEvent.scope())) {
            throw new LearnerDomainException(LearnerDecisionCode.TENANT_MISMATCH,
                    "outbox event is outside the verified scope");
        }
    }
}
