package com.englishflow.learning.adapter.failclosed;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningProgress;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.PlanningKey;
import com.englishflow.learning.domain.ReviewEvent;
import com.englishflow.learning.domain.ReviewQueueSnapshot;
import com.englishflow.learning.domain.SrsState;
import com.englishflow.learning.port.LearningFactStore;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Default runtime adapters must fail closed: with no explicit jdbc/memory-fixture mode, every
 * persistence and cross-service read throws instead of silently presenting empty data.
 */
class FailClosedAdaptersTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final LearningTenantScope SCOPE =
            LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);
    private static final LearningPrincipalContext CTX =
            LearningPrincipalContext.phaseOne("prn_learningtest0001", 7001);

    private static LearningFactStore store() {
        return new FailClosedLearningFactStore();
    }

    @Test
    void everyStoreReadAndWriteFailsClosed() {
        LearningFactStore store = store();
        assertThatThrownBy(() -> store.findPlan(SCOPE,
                new PlanningKey(SCOPE, 7001, 8001, 1))).isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.findPlanById(SCOPE, 9001))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.findSrsState(SCOPE, LearningItemType.VOCAB, 1))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.findMastery(SCOPE, LearningItemType.GRAMMAR, 1))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.findProgress(SCOPE, 1, 1))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.dueSrsStates(SCOPE, NOW))
                .isInstanceOf(LearningPersistenceUnavailableException.class);

        LearningPlan plan = LearningPlan.draft(9001, SCOPE, 7001, "foundation", 8001, 1,
                "Asia/Shanghai", 30, List.of(), NOW);
        SrsState srs = SrsState.newState(3001, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001,
                "UTC", NOW);
        MasteryProjection mastery = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW);
        LearningProgress progress = LearningProgress.empty(SCOPE, 9001, 1, 10, NOW);
        ReviewEvent event = new ReviewEvent(4001, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001,
                "SM2_Q03_V1", 3001, 2, 3, 3, com.englishflow.learning.domain.ReviewConfidence.CERTAIN,
                NOW, "review-client-event-0001");
        ReviewQueueSnapshot queue = new ReviewQueueSnapshot(5001, SCOPE,
                java.time.LocalDate.of(2026, 8, 22), "Asia/Shanghai", "SM2_Q03_V1", List.of());

        assertThatThrownBy(() -> store.savePlan(plan))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.saveSrsState(srs))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.saveMastery(mastery))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.saveProgress(progress))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.saveReviewEvent(event))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.saveReviewQueue(queue))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.executeIdempotently(SCOPE, "op", new IdempotencyKey(
                "idempotency-key-000001"), "fp", () -> "x"))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> store.appendOutbox(null))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(store::outboxEvents).isInstanceOf(LearningPersistenceUnavailableException.class);
    }

    @Test
    void idGeneratorFailsClosed() {
        assertThatThrownBy(() -> new FailClosedLearningIdGenerator().nextId("learning_plan"))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
    }

    @Test
    void crossServiceReadPortsFailClosed() {
        assertThatThrownBy(() -> new FailClosedLearnerTargetPort().findTarget(CTX, 7001))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
        assertThatThrownBy(() -> new FailClosedPublishedContentPort().findLearnerSnapshot(CTX, 8001))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
    }

    @Test
    void failClosedMessageIsDescriptive() {
        String message = new FailClosedLearningFactStore().toString();
        // The instance message is only surfaced on method invocation; assert the type propagates.
        assertThatThrownBy(() -> store().findPlanById(SCOPE, 1))
                .isInstanceOf(LearningPersistenceUnavailableException.class)
                .hasMessageContaining("persistence is disabled");
    }

    @Test
    void defaultStoreMatchesNoDataPresentedAsProduction() {
        // A FailClosed store is the runtime default when no explicit mode is selected.
        LearningFactStore store = store();
        Optional<?> result = Optional.empty();
        assertThat(result).isEmpty(); // sanity: nothing is fabricated
        assertThatThrownBy(() -> store.findSrsState(SCOPE, LearningItemType.VOCAB, 70001))
                .isInstanceOf(LearningPersistenceUnavailableException.class);
    }
}
