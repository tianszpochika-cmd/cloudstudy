package com.englishflow.learning.port;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningOutboxEvent;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningProgress;
import com.englishflow.learning.domain.ReviewEvent;
import com.englishflow.learning.domain.ReviewQueueSnapshot;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.PlanningKey;
import com.englishflow.learning.domain.SrsState;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * The only persistence boundary for learning facts. A real adapter must make the fact changes,
 * idempotency record and outbox append one local transaction inside the learning schema.
 */
public interface LearningFactStore {

    Optional<LearningPlan> findPlan(LearningTenantScope scope, PlanningKey key);

    Optional<LearningPlan> findPlanById(LearningTenantScope scope, long planId);

    Optional<SrsState> findSrsState(LearningTenantScope scope,
            com.englishflow.learning.domain.LearningItemType itemType, long itemId);

    Optional<MasteryProjection> findMastery(LearningTenantScope scope,
            com.englishflow.learning.domain.LearningItemType itemType, long itemId);

    Optional<LearningProgress> findProgress(LearningTenantScope scope, long planId, long taskId);

    List<SrsState> dueSrsStates(LearningTenantScope scope, Instant dueBy);

    <T> IdempotentExecution<T> executeIdempotently(LearningTenantScope scope, String operation, IdempotencyKey key,
            String requestFingerprint, Supplier<T> action);

    void savePlan(LearningPlan plan);

    void saveSrsState(SrsState state);

    void saveReviewEvent(ReviewEvent event);

    void saveMastery(MasteryProjection projection);

    void saveProgress(LearningProgress progress);

    /** Persist the owner-scoped queue snapshot used to replay a generated review queue. */
    void saveReviewQueue(ReviewQueueSnapshot snapshot);

    void appendOutbox(LearningOutboxEvent event);

    List<LearningOutboxEvent> outboxEvents();
}
