package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** LearningPlan lifecycle: draft -> active -> paused/cancelled/completed. */
class LearningPlanStateMachineTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final LearningTenantScope SCOPE =
            LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);

    private static LearningTask task(long id) {
        return LearningTask.planned(id, LearningTaskType.VOCABULARY_REVIEW, 70001, 8001,
                LocalDate.of(2026, 8, 22), NOW);
    }

    private static LearningPlan draft(List<LearningTask> tasks) {
        return LearningPlan.draft(9001, SCOPE, 7001, "foundation", 8001, 1, "Asia/Shanghai",
                30, tasks, NOW);
    }

    @Test
    void draftPlanResumesToActiveWithVersionBump() {
        LearningPlan plan = draft(List.of(task(1)));
        assertThat(plan.status()).isEqualTo(LearningPlanStatus.DRAFT);
        assertThat(plan.version()).isEqualTo(1);

        LearningPlan resumed = plan.resume(NOW.plusSeconds(1));
        assertThat(resumed.status()).isEqualTo(LearningPlanStatus.ACTIVE);
        assertThat(resumed.version()).isEqualTo(2);
    }

    @Test
    void resumeOfActivePlanIsIdempotent() {
        LearningPlan active = draft(List.of(task(1))).resume(NOW);
        LearningPlan again = active.resume(NOW.plusSeconds(1));
        assertThat(again).isSameAs(active);
    }

    @Test
    void resumeRejectsCompletedOrCancelled() {
        LearningPlan done = draft(List.of(task(1))).cancel(NOW);
        assertThatThrownBy(() -> done.resume(NOW.plusSeconds(1)))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));
    }

    @Test
    void pauseRequiresActivePlan() {
        LearningPlan active = draft(List.of(task(1))).resume(NOW);
        LearningPlan paused = active.pause(NOW.plusSeconds(1));
        assertThat(paused.status()).isEqualTo(LearningPlanStatus.PAUSED);
        assertThat(paused.version()).isEqualTo(active.version() + 1);

        assertThatThrownBy(() -> draft(List.of(task(1))).pause(NOW))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));
    }

    @Test
    void cancelRejectsAlreadyTerminalPlan() {
        LearningPlan cancelled = draft(List.of(task(1))).cancel(NOW);
        assertThat(cancelled.status()).isEqualTo(LearningPlanStatus.CANCELLED);
        assertThatThrownBy(() -> cancelled.cancel(NOW.plusSeconds(1)))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));

        LearningPlan completed = draft(List.of(task(1))).resume(NOW).completeTask(1, NOW.plusSeconds(1));
        assertThatThrownBy(() -> completed.cancel(NOW.plusSeconds(1)))
                .isInstanceOf(LearningDomainException.class);
    }

    @Test
    void completingLastTaskCompletesThePlan() {
        LearningPlan plan = draft(List.of(task(1), task(2))).resume(NOW);
        LearningPlan afterFirst = plan.completeTask(1, NOW.plusSeconds(1));
        assertThat(afterFirst.status()).isEqualTo(LearningPlanStatus.ACTIVE);
        assertThat(afterFirst.tasks().get(0).status()).isEqualTo(LearningTaskStatus.COMPLETED);

        LearningPlan afterSecond = afterFirst.completeTask(2, NOW.plusSeconds(2));
        assertThat(afterSecond.status()).isEqualTo(LearningPlanStatus.COMPLETED);
    }

    @Test
    void recompletingAnAlreadyCompletedTaskIsIdempotent() {
        LearningPlan plan = draft(List.of(task(1))).resume(NOW);
        LearningPlan once = plan.completeTask(1, NOW.plusSeconds(1));
        LearningPlan twice = once.completeTask(1, NOW.plusSeconds(2));
        assertThat(twice).isSameAs(once);
        assertThat(twice.version()).isEqualTo(once.version());
    }

    @Test
    void completingTaskOnDraftPlanIsRejected() {
        LearningPlan plan = draft(List.of(task(1)));
        assertThatThrownBy(() -> plan.completeTask(1, NOW))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));
    }

    @Test
    void completingUnknownTaskIsRejected() {
        LearningPlan plan = draft(List.of(task(1))).resume(NOW);
        assertThatThrownBy(() -> plan.completeTask(9999, NOW))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.TASK_NOT_FOUND));
    }

    @Test
    void firstProgressOnDraftPlanActivatesIt() {
        LearningPlan plan = draft(List.of(task(1)));
        LearningPlan withProgress = plan.saveTaskProgress(1, 40, NOW.plusSeconds(1));
        assertThat(withProgress.status()).isEqualTo(LearningPlanStatus.ACTIVE);
        assertThat(withProgress.tasks().get(0).progressPercent()).isEqualTo(40);
        assertThat(withProgress.tasks().get(0).status()).isEqualTo(LearningTaskStatus.IN_PROGRESS);
    }

    @Test
    void progressCannotMoveBackwardsOrExceed100() {
        LearningPlan plan = draft(List.of(task(1))).saveTaskProgress(1, 40, NOW);
        assertThatThrownBy(() -> plan.saveTaskProgress(1, 30, NOW.plusSeconds(1)))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.PROGRESS_INVALID));
        assertThatThrownBy(() -> plan.saveTaskProgress(1, 200, NOW.plusSeconds(1)))
                .isInstanceOf(LearningDomainException.class);
    }

    @Test
    void constructorRejectsInvalidGoalCodeAndQuota() {
        assertThatThrownBy(() -> LearningPlan.draft(9001, SCOPE, 7001, "Foundation", 8001, 1,
                "Asia/Shanghai", 30, List.of(task(1)), NOW))
                .isInstanceOf(IllegalArgumentException.class); // uppercase goal code
        assertThatThrownBy(() -> LearningPlan.draft(9001, SCOPE, 7001, "foundation", 8001, 1,
                "Asia/Shanghai", 60, List.of(task(1)), NOW))
                .isInstanceOf(IllegalArgumentException.class); // retired 60-min quota
        assertThatThrownBy(() -> LearningPlan.draft(0, SCOPE, 7001, "foundation", 8001, 1,
                "Asia/Shanghai", 30, List.of(task(1)), NOW))
                .isInstanceOf(IllegalArgumentException.class); // planId<1
    }
}
