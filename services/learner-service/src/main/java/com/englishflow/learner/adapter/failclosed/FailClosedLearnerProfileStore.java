package com.englishflow.learner.adapter.failclosed;

import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.IdempotencyRecord;
import com.englishflow.learner.domain.FirstDayProjection;
import com.englishflow.learner.domain.LearnerCommitResult;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerMutation;
import com.englishflow.learner.domain.LearnerProfile;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.port.LearnerProfileStore;

import java.util.Optional;

/**
 * No-data adapter used when persistence is not explicitly configured.
 * It makes the HTTP seam return a service-unavailable boundary instead of sample data.
 */
public final class FailClosedLearnerProfileStore implements LearnerProfileStore {

    private static LearnerDomainException unavailable() {
        return new LearnerDomainException(
                LearnerDecisionCode.STORE_FAILURE,
                "learner persistence is disabled; configure LEARNER_PERSISTENCE_MODE=jdbc");
    }

    @Override
    public java.util.List<LearnerTenantScope> search(String tenantId, String query, int limit, String afterSubjectId) {
        throw unavailable();
    }

    @Override
    public Optional<LearnerProfile> find(LearnerTenantScope scope) {
        throw unavailable();
    }

    @Override
    public Optional<FirstDayProjection> findFirstDay(LearnerTenantScope scope) {
        throw unavailable();
    }

    @Override
    public Optional<IdempotencyRecord> findIdempotency(
            LearnerTenantScope scope,
            String operation,
            IdempotencyKey key) {
        throw unavailable();
    }

    @Override
    public LearnerCommitResult commit(LearnerMutation mutation) {
        throw unavailable();
    }
}
