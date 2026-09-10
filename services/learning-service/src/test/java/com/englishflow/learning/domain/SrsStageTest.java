package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** SRS stage transition matrix and the ladder mapping. */
class SrsStageTest {

    @Test
    void newOnlyTransitionsToLearning() {
        SrsStage.assertTransition(SrsStage.NEW, SrsStage.LEARNING);
        assertIllegal(SrsStage.NEW, SrsStage.MASTERED);
        assertIllegal(SrsStage.NEW, SrsStage.CONSOLIDATED);
    }

    @Test
    void learningOnlyTransitionsToMastered() {
        SrsStage.assertTransition(SrsStage.LEARNING, SrsStage.MASTERED);
        assertIllegal(SrsStage.LEARNING, SrsStage.NEW);
        assertIllegal(SrsStage.LEARNING, SrsStage.CONSOLIDATED);
    }

    @Test
    void masteredTransitionsToConsolidatedOrLearning() {
        SrsStage.assertTransition(SrsStage.MASTERED, SrsStage.CONSOLIDATED);
        SrsStage.assertTransition(SrsStage.MASTERED, SrsStage.LEARNING);
        assertIllegal(SrsStage.MASTERED, SrsStage.NEW);
    }

    @Test
    void consolidatedOnlyTransitionsToLearning() {
        SrsStage.assertTransition(SrsStage.CONSOLIDATED, SrsStage.LEARNING);
        assertIllegal(SrsStage.CONSOLIDATED, SrsStage.MASTERED);
        assertIllegal(SrsStage.CONSOLIDATED, SrsStage.NEW);
    }

    @Test
    void sameStageTransitionIsAllowed() {
        SrsStage.assertTransition(SrsStage.LEARNING, SrsStage.LEARNING);
        SrsStage.assertTransition(SrsStage.MASTERED, SrsStage.MASTERED);
    }

    @Test
    void nullArgumentsAreRejected() {
        assertThatThrownBy(() -> SrsStage.assertTransition(null, SrsStage.LEARNING))
                .isInstanceOf(LearningDomainException.class);
        assertThatThrownBy(() -> SrsStage.assertTransition(SrsStage.NEW, null))
                .isInstanceOf(LearningDomainException.class);
    }

    @Test
    void fromSelectsStageByRepetitionsIntervalAndQuality() {
        assertThat(SrsStage.from(1, 1, 3)).isEqualTo(SrsStage.LEARNING);
        assertThat(SrsStage.from(4, 30, 3)).isEqualTo(SrsStage.MASTERED);
        assertThat(SrsStage.from(6, 90, 3)).isEqualTo(SrsStage.CONSOLIDATED);
        assertThat(SrsStage.from(4, 90, 3)).isEqualTo(SrsStage.MASTERED); // interval gate before rep gate
        assertThat(SrsStage.from(7, 29, 3)).isEqualTo(SrsStage.LEARNING);  // rep>=6 needs interval>=90
        assertThat(SrsStage.from(2, 1, 1)).isEqualTo(SrsStage.LEARNING);  // quality<2
        assertThat(SrsStage.from(0, 0, 0)).isEqualTo(SrsStage.LEARNING);
    }

    private static void assertIllegal(SrsStage from, SrsStage to) {
        assertThatThrownBy(() -> SrsStage.assertTransition(from, to))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));
    }
}
