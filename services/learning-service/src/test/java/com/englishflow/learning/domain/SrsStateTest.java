package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** SrsState invariants and the apply() replay guard. */
class SrsStateTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final LearningTenantScope SCOPE =
            LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);

    @Test
    void newStateHasSaneDefaults() {
        SrsState state = SrsState.newState(3001, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001,
                "UTC", NOW);
        assertThat(state.stage()).isEqualTo(SrsStage.NEW);
        assertThat(state.easinessFactor()).isEqualTo(2.5d);
        assertThat(state.repetitions()).isZero();
        assertThat(state.intervalDays()).isZero();
        assertThat(state.lapseCount()).isZero();
        assertThat(state.stateVersion()).isEqualTo(1);
        assertThat(state.lastReviewedAt()).isNull();
        assertThat(state.dueAt()).isEqualTo(NOW);
    }

    @Test
    void constructorRejectsNonSrsEligibleItemType() {
        assertThatThrownBy(() -> new SrsState(1, SCOPE, LearningItemType.GRAMMAR, 1, 1, 1,
                SrsStage.NEW, 2.5d, 0, 0, 0, "UTC", NOW, null, 1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void constructorRejectsNegativeOrZeroIdentifiers() {
        assertThatThrownBy(() -> new SrsState(0, SCOPE, LearningItemType.VOCAB, 1, 1, 1,
                SrsStage.NEW, 2.5d, 0, 0, 0, "UTC", NOW, null, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SrsState(1, SCOPE, LearningItemType.VOCAB, 0, 1, 1,
                SrsStage.NEW, 2.5d, 0, 0, 0, "UTC", NOW, null, 1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void constructorRejectsInvalidNumericState() {
        assertThatThrownBy(() -> new SrsState(1, SCOPE, LearningItemType.VOCAB, 1, 1, 1,
                SrsStage.NEW, 1.0d, 0, 0, 0, "UTC", NOW, null, 1))
                .isInstanceOf(IllegalArgumentException.class); // ef below MIN_EASE
        assertThatThrownBy(() -> new SrsState(1, SCOPE, LearningItemType.VOCAB, 1, 1, 1,
                SrsStage.NEW, 2.5d, -1, 0, 0, "UTC", NOW, null, 1))
                .isInstanceOf(IllegalArgumentException.class); // negative repetitions
    }

    @Test
    void constructorRejectsBlankOrUnknownTimeZoneAndMissingDue() {
        assertThatThrownBy(() -> new SrsState(1, SCOPE, LearningItemType.VOCAB, 1, 1, 1,
                SrsStage.NEW, 2.5d, 0, 0, 0, "", NOW, null, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SrsState(1, SCOPE, LearningItemType.VOCAB, 1, 1, 1,
                SrsStage.NEW, 2.5d, 0, 0, 0, "Mars/Phobos", NOW, null, 1))
                .isInstanceOf(java.time.zone.ZoneRulesException.class); // invalid zone
        assertThatThrownBy(() -> new SrsState(1, SCOPE, LearningItemType.VOCAB, 1, 1, 1,
                SrsStage.NEW, 2.5d, 0, 0, 0, "UTC", null, null, 1))
                .isInstanceOf(NullPointerException.class); // null dueAt
    }

    @Test
    void constructorRejectsNonPositiveStateVersion() {
        assertThatThrownBy(() -> new SrsState(1, SCOPE, LearningItemType.VOCAB, 1, 1, 1,
                SrsStage.NEW, 2.5d, 0, 0, 0, "UTC", NOW, null, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void applyGuardsAgainstVersionConflict() {
        SrsState state = SrsState.newState(3001, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001,
                "UTC", NOW);
        Sm2ReviewResult r = Sm2Scheduler.review(state, 3, ReviewConfidence.CERTAIN, NOW);
        SrsState next = state.apply(r);
        assertThat(next.stateVersion()).isEqualTo(2);

        Sm2ReviewResult wrongVersion = new Sm2ReviewResult(SrsStage.NEW, SrsStage.LEARNING, 3, 3,
                2.5d, 1, 1, 0, NOW.plusSeconds(10), NOW, 5); // nextStateVersion 5 != 3
        assertThatThrownBy(() -> next.apply(wrongVersion))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.VERSION_CONFLICT));
    }

    @Test
    void applyGuardsAgainstResultFromAnotherState() {
        SrsState state = SrsState.newState(3001, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001,
                "UTC", NOW);
        Sm2ReviewResult r = Sm2Scheduler.review(state, 3, ReviewConfidence.CERTAIN, NOW);
        SrsState next = state.apply(r);

        // A result whose beforeStage does not match `next.stage()` must be rejected.
        Sm2ReviewResult mismatched = new Sm2ReviewResult(SrsStage.NEW, SrsStage.LEARNING, 3, 3,
                2.5d, 1, 1, 0, NOW.plusSeconds(10), NOW, 3);
        assertThatThrownBy(() -> next.apply(mismatched))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));
    }

    @Test
    void applyRejectsNullResult() {
        SrsState state = SrsState.newState(3001, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001,
                "UTC", NOW);
        assertThatThrownBy(() -> state.apply(null))
                .isInstanceOf(NullPointerException.class);
    }
}
