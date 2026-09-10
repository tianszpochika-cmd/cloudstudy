package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** LearningTask progress/complete state machine and validation. */
class LearningTaskStateMachineTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final LocalDate DATE = LocalDate.of(2026, 8, 22);

    private static LearningTask planned() {
        return LearningTask.planned(1, LearningTaskType.VOCABULARY_REVIEW, 70001, 8001, DATE, NOW);
    }

    @Test
    void plannedTaskCompletesToHundredPercent() {
        LearningTask done = planned().complete(NOW);
        assertThat(done.status()).isEqualTo(LearningTaskStatus.COMPLETED);
        assertThat(done.progressPercent()).isEqualTo(100);
        assertThat(done.completionVersion()).isEqualTo(1);
    }

    @Test
    void recompletingCompletedTaskIsIdempotent() {
        LearningTask done = planned().complete(NOW);
        assertThat(done.complete(NOW.plusSeconds(1))).isSameAs(done);
    }

    @Test
    void skippedOrExpiredTaskCannotComplete() {
        LearningTask skipped = new LearningTask(1, LearningTaskType.READING, 80001, 8001, DATE,
                LearningTaskStatus.SKIPPED, 0, 0, NOW);
        assertThatThrownBy(() -> skipped.complete(NOW))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));

        LearningTask expired = new LearningTask(2, LearningTaskType.READING, 80002, 8001, DATE,
                LearningTaskStatus.EXPIRED, 0, 0, NOW);
        assertThatThrownBy(() -> expired.complete(NOW))
                .isInstanceOf(LearningDomainException.class);
    }

    @Test
    void progressMustBeMonotonicAndBounded() {
        LearningTask inProgress = planned().saveProgress(40, NOW);
        assertThat(inProgress.status()).isEqualTo(LearningTaskStatus.IN_PROGRESS);
        assertThat(inProgress.progressPercent()).isEqualTo(40);

        LearningTask more = inProgress.saveProgress(80, NOW.plusSeconds(1));
        assertThat(more.progressPercent()).isEqualTo(80);

        assertThatThrownBy(() -> inProgress.saveProgress(20, NOW.plusSeconds(2)))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.PROGRESS_INVALID));
        assertThatThrownBy(() -> inProgress.saveProgress(120, NOW.plusSeconds(2)))
                .isInstanceOf(LearningDomainException.class);
    }

    @Test
    void completedTaskCannotReceiveFurtherProgress() {
        LearningTask done = planned().complete(NOW);
        assertThatThrownBy(() -> done.saveProgress(100, NOW.plusSeconds(1)))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));
    }

    @Test
    void zeroProgressKeepsPlannedStatus() {
        LearningTask same = planned().saveProgress(0, NOW);
        assertThat(same.status()).isEqualTo(LearningTaskStatus.PLANNED);
    }

    @Test
    void constructorRejectsInvalidIdentifiersAndProgress() {
        assertThatThrownBy(() -> new LearningTask(0, LearningTaskType.READING, 1, 1, DATE,
                LearningTaskStatus.PLANNED, 0, 0, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LearningTask(1, LearningTaskType.READING, 1, 1, DATE,
                LearningTaskStatus.PLANNED, -1, 0, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LearningTask(1, LearningTaskType.READING, 1, 1, DATE,
                LearningTaskStatus.PLANNED, 101, 0, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
