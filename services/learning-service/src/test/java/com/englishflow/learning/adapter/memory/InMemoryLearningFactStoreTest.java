package com.englishflow.learning.adapter.memory;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.SrsState;
import com.englishflow.learning.port.IdempotentExecution;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** In-memory fixture store behavior: persistence, idempotency replay, due-queue ordering. */
class InMemoryLearningFactStoreTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final LearningTenantScope SCOPE =
            LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);
    private static final IdempotencyKey KEY = new IdempotencyKey("idempotency-key-000001");

    private static LearningPlan samplePlan() {
        return LearningPlan.draft(9001, SCOPE, 7001, "foundation", 8001, 1, "Asia/Shanghai", 30,
                List.of(), NOW);
    }

    @Test
    void planIsSavedAndFoundById() {
        InMemoryLearningFactStore store = new InMemoryLearningFactStore();
        store.savePlan(samplePlan());
        Optional<LearningPlan> found = store.findPlanById(SCOPE, 9001);
        assertThat(found).isPresent();
        assertThat(found.get().planId()).isEqualTo(9001);
    }

    @Test
    void srsAndMasteryFactsArePersistedPerOwner() {
        InMemoryLearningFactStore store = new InMemoryLearningFactStore();
        SrsState srs = SrsState.newState(3001, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001,
                "UTC", NOW);
        store.saveSrsState(srs);
        assertThat(store.findSrsState(SCOPE, LearningItemType.VOCAB, 70001)).contains(srs);

        MasteryProjection mastery = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001,
                NOW);
        store.saveMastery(mastery);
        assertThat(store.findMastery(SCOPE, LearningItemType.GRAMMAR, 71001)).contains(mastery);

        // Different owner sees nothing.
        LearningTenantScope other = LearningTenantScope.forPhaseOne("prn_other0000000002", 7002);
        assertThat(store.findSrsState(other, LearningItemType.VOCAB, 70001)).isEmpty();
    }

    @Test
    void idempotentExecutionReplaysSameKeyAndFingerprint() {
        InMemoryLearningFactStore store = new InMemoryLearningFactStore();
        IdempotentExecution<String> first = store.executeIdempotently(SCOPE, "review.submit", KEY,
                "fp-1", () -> "write-1");
        assertThat(first.replayed()).isFalse();
        assertThat(first.value()).isEqualTo("write-1");

        IdempotentExecution<String> replay = store.executeIdempotently(SCOPE, "review.submit", KEY,
                "fp-1", () -> "write-2");
        assertThat(replay.replayed()).isTrue();
        assertThat(replay.value()).isEqualTo("write-1"); // action NOT re-run
    }

    @Test
    void idempotencyKeyReusedForDifferentPayloadConflicts() {
        InMemoryLearningFactStore store = new InMemoryLearningFactStore();
        store.executeIdempotently(SCOPE, "review.submit", KEY, "fp-1", () -> "write-1");
        assertThatThrownBy(() -> store.executeIdempotently(SCOPE, "review.submit", KEY, "fp-2",
                () -> "write-2"))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.IDEMPOTENCY_CONFLICT));
    }

    @Test
    void dueSrsStatesAreOrderedByDueDateThenId() {
        InMemoryLearningFactStore store = new InMemoryLearningFactStore();
        SrsState early = SrsState.newState(3005, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001,
                "UTC", NOW);
        SrsState later = SrsState.newState(3002, SCOPE, LearningItemType.PHRASE, 9001, 70002, 8001,
                "UTC", NOW.plus(Duration.ofDays(1)));
        // tie-break case: same due instant, lower id should sort first
        SrsState tieHigh = SrsState.newState(3009, SCOPE, LearningItemType.EXPRESSION, 9001, 70003,
                8001, "UTC", NOW.plus(Duration.ofDays(2)));
        SrsState tieLow = SrsState.newState(3001, SCOPE, LearningItemType.EXPRESSION, 9001, 70004,
                8001, "UTC", NOW.plus(Duration.ofDays(2)));

        store.saveSrsState(later);
        store.saveSrsState(early);
        store.saveSrsState(tieHigh);
        store.saveSrsState(tieLow);

        List<SrsState> due = store.dueSrsStates(SCOPE, NOW.plus(Duration.ofDays(3)));
        assertThat(due.stream().map(SrsState::srsStateId).toList())
                .containsExactly(3005L, 3002L, 3001L, 3009L);
    }
}
