package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Deterministic SRS/SM-2 scheduling algorithm. Pure function, no external state. */
class Sm2SchedulerTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final LearningTenantScope SCOPE =
            LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);

    private static SrsState freshState() {
        return SrsState.newState(3001, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001, "UTC", NOW);
    }

    /** Drive a NEW state through a sequence of CERTAIN reviews with strictly increasing timestamps. */
    private static SrsState ladder(int reviews, int rawQuality) {
        SrsState state = freshState();
        for (int i = 1; i <= reviews; i++) {
            Sm2ReviewResult r = Sm2Scheduler.review(state, rawQuality, ReviewConfidence.CERTAIN,
                    NOW.plusSeconds(i * 3600L));
            state = state.apply(r);
        }
        return state;
    }

    @Test
    void firstReviewFromNewStateIsLearningWithOneDayInterval() {
        Sm2ReviewResult r = Sm2Scheduler.review(freshState(), 3, ReviewConfidence.CERTAIN, NOW);

        assertThat(r.beforeStage()).isEqualTo(SrsStage.NEW);
        assertThat(r.afterStage()).isEqualTo(SrsStage.LEARNING);
        assertThat(r.repetitions()).isEqualTo(1);
        assertThat(r.intervalDays()).isEqualTo(1);
        assertThat(r.lapseCount()).isZero();
        assertThat(r.easinessFactor()).isEqualTo(2.5d); // 2.5 + 0.10 clamped to MAX_EASE
        assertThat(r.dueAt()).isEqualTo(NOW.plus(Duration.ofDays(1)));
        assertThat(r.nextStateVersion()).isEqualTo(2);
    }

    @Test
    void canonicalPerfectLadderReachesMasteredAfterFiveReviews() {
        SrsState state = ladder(5, 3);
        assertThat(state.stage()).isEqualTo(SrsStage.MASTERED);
        assertThat(state.repetitions()).isEqualTo(5);
        assertThat(state.intervalDays()).isEqualTo(30); // INTERVAL_ANCHORS[5]
    }

    @Test
    void perfectLadderReachesConsolidatedAfterSixReviews() {
        SrsState state = ladder(6, 3);
        assertThat(state.stage()).isEqualTo(SrsStage.CONSOLIDATED);
        assertThat(state.repetitions()).isEqualTo(6);
        assertThat(state.intervalDays()).isEqualTo(90); // INTERVAL_ANCHORS[6]
    }

    @Test
    void longTermIntervalGrowsByEasinessFactorAndIsCappedAt365() {
        SrsState state = ladder(7, 3); // rep 7, interval 90 * 2.5 = 225
        assertThat(state.repetitions()).isEqualTo(7);
        assertThat(state.intervalDays()).isEqualTo(225);

        Sm2ReviewResult eighth = Sm2Scheduler.review(state, 3, ReviewConfidence.CERTAIN,
                NOW.plusSeconds(360000L));
        assertThat(eighth.intervalDays()).isEqualTo(365); // 225 * 2.5 = 562.5 -> capped
    }

    @Test
    void guessedConfidenceCapsQualityAndReturnsMasteredItemToLearning() {
        SrsState mastered = ladder(5, 3);
        assertThat(mastered.stage()).isEqualTo(SrsStage.MASTERED);

        Sm2ReviewResult guessed = Sm2Scheduler.review(mastered, 3, ReviewConfidence.GUESSED,
                NOW.plusSeconds(360000L));
        assertThat(guessed.effectiveQuality()).isEqualTo(2); // 3 capped to 2
        assertThat(guessed.afterStage()).isEqualTo(SrsStage.LEARNING);
        assertThat(guessed.lapseCount()).isEqualTo(mastered.lapseCount());
    }

    @Test
    void lapseResetsRepetitionsAndIncrementsLapseCount() {
        SrsState learned = ladder(3, 3); // rep 3, no lapses
        assertThat(learned.lapseCount()).isZero();

        Sm2ReviewResult lapse = Sm2Scheduler.review(learned, 0, ReviewConfidence.CERTAIN,
                NOW.plusSeconds(360000L));
        assertThat(lapse.effectiveQuality()).isZero();
        assertThat(lapse.repetitions()).isZero();
        assertThat(lapse.intervalDays()).isEqualTo(1);
        assertThat(lapse.lapseCount()).isEqualTo(1);
        assertThat(lapse.afterStage()).isEqualTo(SrsStage.LEARNING);
    }

    @Test
    void easinessFactorStaysWithinHardBoundsAfterManyLapses() {
        SrsState state = SrsState.newState(3001, SCOPE, LearningItemType.VOCAB, 9001, 70001, 8001,
                "UTC", NOW);
        for (int i = 1; i <= 8; i++) {
            Sm2ReviewResult r = Sm2Scheduler.review(state, 0, ReviewConfidence.CERTAIN,
                    NOW.plusSeconds(i * 100L));
            state = state.apply(r);
            assertThat(state.easinessFactor()).isBetween(1.30d, 2.50d);
        }
        assertThat(state.easinessFactor()).isEqualTo(1.30d); // clamped to MIN_EASE
    }

    @Test
    void unknownConfidenceCapsPerfectAnswerToQualityOne() {
        Sm2ReviewResult r = Sm2Scheduler.review(freshState(), 3, ReviewConfidence.UNKNOWN, NOW);
        assertThat(r.effectiveQuality()).isEqualTo(1);
        // 2.5 + 0.10 - 2*(0.08 + 2*0.02) = 2.60 - 0.24 = 2.36
        assertThat(r.easinessFactor()).isEqualTo(2.36d);
    }

    @Test
    void qualityBelowTwoForcesLearningStageRegardlessOfRepetitions() {
        SrsState mastered = ladder(6, 3); // CONSOLIDATED
        Sm2ReviewResult r = Sm2Scheduler.review(mastered, 1, ReviewConfidence.CERTAIN,
                NOW.plusSeconds(360000L));
        assertThat(r.effectiveQuality()).isEqualTo(1);
        assertThat(r.afterStage()).isEqualTo(SrsStage.LEARNING);
    }

    @Test
    void invalidQualityIsRejected() {
        assertThatThrownBy(() -> Sm2Scheduler.review(freshState(), 4, ReviewConfidence.CERTAIN, NOW))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_REVIEW));

        assertThatThrownBy(() -> Sm2Scheduler.review(freshState(), -1, ReviewConfidence.CERTAIN, NOW))
                .isInstanceOf(LearningDomainException.class);
    }

    @Test
    void outOfOrderReviewIsRejected() {
        SrsState state = freshState();
        SrsState reviewed = state.apply(
                Sm2Scheduler.review(state, 3, ReviewConfidence.CERTAIN, NOW));
        assertThatThrownBy(() ->
                Sm2Scheduler.review(reviewed, 3, ReviewConfidence.CERTAIN, NOW.minusSeconds(1)))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.REVIEW_OUT_OF_ORDER));
    }

    @Test
    void nullArgumentsAreRejected() {
        assertThatThrownBy(() -> Sm2Scheduler.review(null, 3, ReviewConfidence.CERTAIN, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> Sm2Scheduler.review(freshState(), 3, null, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> Sm2Scheduler.review(freshState(), 3, ReviewConfidence.CERTAIN, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void dstCalendarArithmeticUsesLearnerLocalDay() {
        Instant beforeDst = Instant.parse("2026-03-08T06:30:00Z"); // 01:30 EST local
        SrsState state = SrsState.newState(9901, SCOPE, LearningItemType.VOCAB, 9001, 70099, 8001,
                "America/New_York", beforeDst);
        Sm2ReviewResult r = Sm2Scheduler.review(state, 3, ReviewConfidence.CERTAIN, beforeDst);

        assertThat(r.dueAt().atZone(ZoneId.of("America/New_York")).toLocalDate())
                .isEqualTo(LocalDate.of(2026, 3, 9));
        assertThat(Duration.between(beforeDst, r.dueAt())).isEqualTo(Duration.ofHours(23));
    }

    @Test
    void algorithmVersionIsPinned() {
        assertThat(Sm2Scheduler.ALGORITHM_VERSION).isEqualTo("SM2_Q03_V1");
    }
}
