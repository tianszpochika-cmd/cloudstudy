package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Mastery stage transition matrix and the projection ladder mapping. */
class MasteryStageTest {

    @Test
    void newOnlyTransitionsToLearning() {
        MasteryStage.assertTransition(MasteryStage.NEW, MasteryStage.LEARNING);
        assertIllegal(MasteryStage.NEW, MasteryStage.MASTERED);
        assertIllegal(MasteryStage.NEW, MasteryStage.CONSOLIDATED);
    }

    @Test
    void learningTransitionsToMasteredOrConsolidated() {
        MasteryStage.assertTransition(MasteryStage.LEARNING, MasteryStage.MASTERED);
        MasteryStage.assertTransition(MasteryStage.LEARNING, MasteryStage.CONSOLIDATED);
        assertIllegal(MasteryStage.LEARNING, MasteryStage.NEW);
    }

    @Test
    void masteredTransitionsToConsolidatedOrLearning() {
        MasteryStage.assertTransition(MasteryStage.MASTERED, MasteryStage.CONSOLIDATED);
        MasteryStage.assertTransition(MasteryStage.MASTERED, MasteryStage.LEARNING);
        assertIllegal(MasteryStage.MASTERED, MasteryStage.NEW);
    }

    @Test
    void consolidatedOnlyTransitionsToLearning() {
        MasteryStage.assertTransition(MasteryStage.CONSOLIDATED, MasteryStage.LEARNING);
        assertIllegal(MasteryStage.CONSOLIDATED, MasteryStage.MASTERED);
        assertIllegal(MasteryStage.CONSOLIDATED, MasteryStage.NEW);
    }

    @Test
    void sameStageTransitionIsAllowed() {
        MasteryStage.assertTransition(MasteryStage.LEARNING, MasteryStage.LEARNING);
    }

    @Test
    void nullArgumentsAreRejected() {
        assertThatThrownBy(() -> MasteryStage.assertTransition(null, MasteryStage.LEARNING))
                .isInstanceOf(LearningDomainException.class);
    }

    @Test
    void fromSelectsStageByScoreAttemptsAndVerification() {
        assertThat(MasteryStage.from(0, 0, VerificationStage.D0)).isEqualTo(MasteryStage.NEW);
        assertThat(MasteryStage.from(50, 1, VerificationStage.D1)).isEqualTo(MasteryStage.LEARNING);
        assertThat(MasteryStage.from(85, 3, VerificationStage.D1)).isEqualTo(MasteryStage.MASTERED);
        assertThat(MasteryStage.from(95, 3, VerificationStage.D7)).isEqualTo(MasteryStage.CONSOLIDATED);
        assertThat(MasteryStage.from(95, 2, VerificationStage.D7)).isEqualTo(MasteryStage.LEARNING); // attempts<3
        assertThat(MasteryStage.from(80, 3, VerificationStage.D1)).isEqualTo(MasteryStage.LEARNING);  // score<95 no D7
    }

    private static void assertIllegal(MasteryStage from, MasteryStage to) {
        assertThatThrownBy(() -> MasteryStage.assertTransition(from, to))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));
    }
}
