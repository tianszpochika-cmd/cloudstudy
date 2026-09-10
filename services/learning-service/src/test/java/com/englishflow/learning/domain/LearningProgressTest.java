package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Monotonic LearningProgress fact. */
class LearningProgressTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final LearningTenantScope SCOPE =
            LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);

    @Test
    void emptyProgressHasZeroUnits() {
        LearningProgress p = LearningProgress.empty(SCOPE, 9001, 1, 10, NOW);
        assertThat(p.completedUnits()).isZero();
        assertThat(p.totalUnits()).isEqualTo(10);
        assertThat(p.studySeconds()).isZero();
        assertThat(p.version()).isZero();
        assertThat(p.percent()).isZero();
    }

    @Test
    void advanceIsMonotonicAndBumpsVersion() {
        LearningProgress p = LearningProgress.empty(SCOPE, 9001, 1, 10, NOW);
        LearningProgress next = p.advance(5, 120, 0, NOW.plusSeconds(1));
        assertThat(next.completedUnits()).isEqualTo(5);
        assertThat(next.studySeconds()).isEqualTo(120);
        assertThat(next.version()).isEqualTo(1);
        assertThat(next.percent()).isEqualTo(50);

        LearningProgress more = next.advance(10, 60, 1, NOW.plusSeconds(2));
        assertThat(more.completedUnits()).isEqualTo(10);
        assertThat(more.studySeconds()).isEqualTo(180);
        assertThat(more.percent()).isEqualTo(100);
        assertThat(more.version()).isEqualTo(2);
    }

    @Test
    void advanceRejectsVersionConflict() {
        LearningProgress p = LearningProgress.empty(SCOPE, 9001, 1, 10, NOW);
        assertThatThrownBy(() -> p.advance(5, 1, 3, NOW))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.VERSION_CONFLICT));
    }

    @Test
    void advanceRejectsNonMonotonicOrOutOfBounds() {
        LearningProgress p = LearningProgress.empty(SCOPE, 9001, 1, 10, NOW).advance(5, 1, 0, NOW);
        assertThatThrownBy(() -> p.advance(3, 1, 1, NOW))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.PROGRESS_INVALID));
        assertThatThrownBy(() -> p.advance(11, 1, 1, NOW))
                .isInstanceOf(LearningDomainException.class);
        assertThatThrownBy(() -> p.advance(6, -1, 1, NOW))
                .isInstanceOf(LearningDomainException.class);
    }

    @Test
    void constructorRejectsInvalidUnits() {
        assertThatThrownBy(() -> new LearningProgress(SCOPE, 9001, 1, 5, 0, 0, 0, NOW))
                .isInstanceOf(IllegalArgumentException.class); // totalUnits<1
        assertThatThrownBy(() -> new LearningProgress(SCOPE, 9001, 1, 7, 6, 0, 0, NOW))
                .isInstanceOf(IllegalArgumentException.class); // completed>total
    }
}
