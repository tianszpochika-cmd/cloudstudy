package com.englishflow.learning.adapter.memory;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningOutboxEvent;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningProgress;
import com.englishflow.learning.domain.LearningSchema;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.PlanningKey;
import com.englishflow.learning.domain.ReviewEvent;
import com.englishflow.learning.domain.ReviewQueueSnapshot;
import com.englishflow.learning.domain.SrsState;
import com.englishflow.learning.port.LearningFactStore;
import com.englishflow.learning.port.IdempotentExecution;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * In-memory learning-schema fixture. The synchronized idempotency method models the local
 * transaction seam; a durable adapter must preserve the same behavior with a unique constraint.
 */
public final class InMemoryLearningFactStore implements LearningFactStore {

    private final Map<String, LearningPlan> plansByKey = new LinkedHashMap<>();
    private final Map<String, LearningPlan> plansById = new LinkedHashMap<>();
    private final Map<String, SrsState> srsByKey = new LinkedHashMap<>();
    private final Map<String, ReviewEvent> reviewEventsById = new LinkedHashMap<>();
    private final Map<String, MasteryProjection> masteryByKey = new LinkedHashMap<>();
    private final Map<String, LearningProgress> progressByKey = new LinkedHashMap<>();
    private final Map<String, ReviewQueueSnapshot> reviewQueuesByKey = new LinkedHashMap<>();
    private final Map<String, IdempotencyEntry> idempotency = new LinkedHashMap<>();
    private final Map<String, LearningOutboxEvent> outboxByDedupe = new LinkedHashMap<>();

    @Override
    public synchronized Optional<LearningPlan> findPlan(LearningTenantScope scope, PlanningKey key) {
        requireScope(scope, key.scope());
        return Optional.ofNullable(plansByKey.get(key.storageKey()));
    }

    @Override
    public synchronized Optional<LearningPlan> findPlanById(LearningTenantScope scope, long planId) {
        LearningPlan plan = plansById.get(planKey(scope, planId));
        if (plan != null) {
            scope.assertResource(plan.scope().tenantId(), plan.scope().principalId());
        }
        return Optional.ofNullable(plan);
    }

    @Override
    public synchronized Optional<SrsState> findSrsState(LearningTenantScope scope,
            LearningItemType itemType, long itemId) {
        return Optional.ofNullable(srsByKey.get(srsKey(scope, itemType, itemId)));
    }

    @Override
    public synchronized Optional<MasteryProjection> findMastery(LearningTenantScope scope,
            LearningItemType itemType, long itemId) {
        return Optional.ofNullable(masteryByKey.get(itemKey(scope, itemType, itemId)));
    }

    @Override
    public synchronized Optional<LearningProgress> findProgress(LearningTenantScope scope,
            long planId, long taskId) {
        return Optional.ofNullable(progressByKey.get(progressKey(scope, planId, taskId)));
    }

    @Override
    public synchronized List<SrsState> dueSrsStates(LearningTenantScope scope, Instant dueBy) {
        return srsByKey.values().stream()
                .filter(state -> state.scope().equals(scope) && !state.dueAt().isAfter(dueBy))
                .sorted(Comparator.comparing(SrsState::dueAt).thenComparingLong(SrsState::srsStateId))
                .toList();
    }

    @Override
    @SuppressWarnings("unchecked")
    public synchronized <T> IdempotentExecution<T> executeIdempotently(LearningTenantScope scope,
            String operation,
            IdempotencyKey key, String requestFingerprint, Supplier<T> action) {
        String namespaced = key.namespaced(scope, operation);
        IdempotencyEntry previous = idempotency.get(namespaced);
        if (previous != null) {
            if (!previous.requestFingerprint().equals(requestFingerprint)) {
                throw new LearningDomainException(LearningDecisionCode.IDEMPOTENCY_CONFLICT,
                        "Idempotency-Key cannot be reused for another payload");
            }
            return new IdempotentExecution<>((T) previous.response(), true);
        }
        T response = action.get();
        idempotency.put(namespaced, new IdempotencyEntry(requestFingerprint, response));
        return new IdempotentExecution<>(response, false);
    }

    @Override
    public synchronized void savePlan(LearningPlan plan) {
        LearningSchema.requireOwnedFact("learning_plan");
        plansByKey.put(new PlanningKey(plan.scope(), plan.targetId(), plan.contentVersionId(),
                plan.contentEpoch()).storageKey(), plan);
        plansById.put(planKey(plan.scope(), plan.planId()), plan);
    }

    @Override
    public synchronized void saveSrsState(SrsState state) {
        LearningSchema.requireOwnedFact("srs_state");
        srsByKey.put(srsKey(state.scope(), state.itemType(), state.itemId()), state);
    }

    @Override
    public synchronized void saveReviewEvent(ReviewEvent event) {
        LearningSchema.requireOwnedFact("review_event");
        String key = event.scope().storageKey() + ":review:" + event.reviewEventId();
        reviewEventsById.putIfAbsent(key, event);
    }

    @Override
    public synchronized void saveMastery(MasteryProjection projection) {
        LearningSchema.requireOwnedFact("mastery_projection");
        masteryByKey.put(itemKey(projection.scope(), projection.itemType(), projection.itemId()), projection);
    }

    @Override
    public synchronized void saveProgress(LearningProgress progress) {
        LearningSchema.requireOwnedFact("learning_progress");
        progressByKey.put(progressKey(progress.scope(), progress.planId(), progress.taskId()), progress);
    }

    @Override
    public synchronized void saveReviewQueue(ReviewQueueSnapshot snapshot) {
        LearningSchema.requireOwnedFact("review_queue_snapshot");
        reviewQueuesByKey.put(snapshotKey(snapshot.scope(), snapshot.scheduleSnapshotId()), snapshot);
    }

    @Override
    public synchronized void appendOutbox(LearningOutboxEvent event) {
        LearningSchema.requireOwnedFact("outbox_event");
        outboxByDedupe.putIfAbsent(event.scope().storageKey() + ":" + event.dedupeKey(), event);
    }

    @Override
    public synchronized List<LearningOutboxEvent> outboxEvents() {
        return new ArrayList<>(outboxByDedupe.values());
    }

    private static void requireScope(LearningTenantScope expected, LearningTenantScope actual) {
        if (!expected.equals(actual)) {
            throw new LearningDomainException(LearningDecisionCode.OWNER_MISMATCH,
                    "learning fact is outside the verified owner scope");
        }
    }

    private static String planKey(LearningTenantScope scope, long planId) {
        return scope.storageKey() + ":plan:" + planId;
    }

    private static String srsKey(LearningTenantScope scope, LearningItemType itemType, long itemId) {
        return scope.storageKey() + ":srs:" + itemType + ":" + itemId;
    }

    private static String itemKey(LearningTenantScope scope, LearningItemType itemType, long itemId) {
        return scope.storageKey() + ":item:" + itemType + ":" + itemId;
    }

    private static String progressKey(LearningTenantScope scope, long planId, long taskId) {
        return scope.storageKey() + ":progress:" + planId + ":" + taskId;
    }

    private static String snapshotKey(LearningTenantScope scope, long snapshotId) {
        return scope.storageKey() + ":queue:" + snapshotId;
    }

    private record IdempotencyEntry(String requestFingerprint, Object response) {
    }
}
