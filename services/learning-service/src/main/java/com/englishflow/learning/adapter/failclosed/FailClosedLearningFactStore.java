package com.englishflow.learning.adapter.failclosed;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningOutboxEvent;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningProgress;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.PlanningKey;
import com.englishflow.learning.domain.ReviewEvent;
import com.englishflow.learning.domain.ReviewQueueSnapshot;
import com.englishflow.learning.domain.SrsState;
import com.englishflow.learning.port.IdempotentExecution;
import com.englishflow.learning.port.LearningFactStore;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Default runtime adapter. It makes the absence of MySQL/fixture data observable instead of
 * silently presenting the in-memory test store as production data.
 */
public final class FailClosedLearningFactStore implements LearningFactStore {

    private final String message;

    public FailClosedLearningFactStore() {
        this("learning persistence is disabled; set LEARNING_PERSISTENCE_MODE=jdbc or "
                + "LEARNING_PERSISTENCE_MODE=memory-fixture explicitly");
    }

    public FailClosedLearningFactStore(String message) {
        this.message = message;
    }

    @Override
    public Optional<LearningPlan> findPlan(LearningTenantScope scope, PlanningKey key) {
        throw unavailable();
    }

    @Override
    public Optional<LearningPlan> findPlanById(LearningTenantScope scope, long planId) {
        throw unavailable();
    }

    @Override
    public Optional<SrsState> findSrsState(LearningTenantScope scope,
            com.englishflow.learning.domain.LearningItemType itemType, long itemId) {
        throw unavailable();
    }

    @Override
    public Optional<MasteryProjection> findMastery(LearningTenantScope scope,
            com.englishflow.learning.domain.LearningItemType itemType, long itemId) {
        throw unavailable();
    }

    @Override
    public Optional<LearningProgress> findProgress(LearningTenantScope scope, long planId, long taskId) {
        throw unavailable();
    }

    @Override
    public List<SrsState> dueSrsStates(LearningTenantScope scope, Instant dueBy) {
        throw unavailable();
    }

    @Override
    public <T> IdempotentExecution<T> executeIdempotently(LearningTenantScope scope, String operation,
            IdempotencyKey key, String requestFingerprint, Supplier<T> action) {
        throw unavailable();
    }

    @Override
    public void savePlan(LearningPlan plan) {
        throw unavailable();
    }

    @Override
    public void saveSrsState(SrsState state) {
        throw unavailable();
    }

    @Override
    public void saveReviewEvent(ReviewEvent event) {
        throw unavailable();
    }

    @Override
    public void saveMastery(MasteryProjection projection) {
        throw unavailable();
    }

    @Override
    public void saveProgress(LearningProgress progress) {
        throw unavailable();
    }

    @Override
    public void saveReviewQueue(ReviewQueueSnapshot snapshot) {
        throw unavailable();
    }

    @Override
    public void appendOutbox(LearningOutboxEvent event) {
        throw unavailable();
    }

    @Override
    public List<LearningOutboxEvent> outboxEvents() {
        throw unavailable();
    }

    private LearningPersistenceUnavailableException unavailable() {
        return new LearningPersistenceUnavailableException(message);
    }
}
