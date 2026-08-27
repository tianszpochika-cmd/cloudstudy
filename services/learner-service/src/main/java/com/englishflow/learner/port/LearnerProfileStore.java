package com.englishflow.learner.port;

import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.IdempotencyRecord;
import com.englishflow.learner.domain.FirstDayProjection;
import com.englishflow.learner.domain.LearnerCommitResult;
import com.englishflow.learner.domain.LearnerMutation;
import com.englishflow.learner.domain.LearnerProfile;
import com.englishflow.learner.domain.LearnerTenantScope;

import java.util.Optional;

/**
 * Learner service's own-schema persistence port.
 * A real adapter must commit profile, idempotency record and outbox event in one local transaction;
 * it must never join or write IAM/core-api/learning-service tables.
 */
public interface LearnerProfileStore {

    Optional<LearnerProfile> find(LearnerTenantScope scope);

    /**
     * Reads the learner-owned first-day projection when one has been materialized.
     * Empty is reserved for an empty or legacy-shadow-only aggregate; an owned profile is
     * expected to have a projection after its first durable commit.
     */
    Optional<FirstDayProjection> findFirstDay(LearnerTenantScope scope);

    Optional<IdempotencyRecord> findIdempotency(
            LearnerTenantScope scope,
            String operation,
            IdempotencyKey key);

    LearnerCommitResult commit(LearnerMutation mutation);
}
