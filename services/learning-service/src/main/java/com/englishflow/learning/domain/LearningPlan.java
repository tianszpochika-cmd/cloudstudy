package com.englishflow.learning.domain;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;

/** Learning-service-owned plan; content and learner services are referenced through ports only. */
public record LearningPlan(
        long planId,
        LearningTenantScope scope,
        long targetId,
        String goalCode,
        long contentVersionId,
        long contentEpoch,
        String timeZoneId,
        int dailyQuotaMinutes,
        LearningPlanStatus status,
        long version,
        List<LearningTask> tasks,
        Instant createdAt,
        Instant updatedAt) {

    public LearningPlan {
        if (planId < 1 || targetId < 1 || contentVersionId < 1 || contentEpoch < 1) {
            throw new IllegalArgumentException("plan identifiers must be positive");
        }
        Objects.requireNonNull(scope, "scope is required");
        if (goalCode == null || !goalCode.matches("[a-z][a-z0-9._-]{1,63}")) {
            throw new IllegalArgumentException("goalCode is invalid");
        }
        if (timeZoneId == null || timeZoneId.isBlank()) {
            throw new IllegalArgumentException("timeZoneId is required");
        }
        ZoneId.of(timeZoneId);
        if (dailyQuotaMinutes < 5 || dailyQuotaMinutes > 240) {
            throw new IllegalArgumentException("dailyQuotaMinutes must be between 5 and 240");
        }
        Objects.requireNonNull(status, "status is required");
        if (version < 1) {
            throw new IllegalArgumentException("plan version must be positive");
        }
        tasks = tasks == null ? List.of() : List.copyOf(tasks);
        Objects.requireNonNull(createdAt, "createdAt is required");
        Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    public static LearningPlan draft(long planId, LearningTenantScope scope, long targetId,
            String goalCode, long contentVersionId, long contentEpoch, String timeZoneId,
            int dailyQuotaMinutes, List<LearningTask> tasks, Instant now) {
        return new LearningPlan(planId, scope, targetId, goalCode, contentVersionId, contentEpoch,
                timeZoneId, dailyQuotaMinutes, LearningPlanStatus.DRAFT, 1, tasks, now, now);
    }

    public LearningPlan resume(Instant now) {
        if (status == LearningPlanStatus.ACTIVE) {
            return this;
        }
        if (status != LearningPlanStatus.DRAFT && status != LearningPlanStatus.PAUSED) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "only draft or paused plans can resume");
        }
        return copy(LearningPlanStatus.ACTIVE, tasks, now);
    }

    public LearningPlan pause(Instant now) {
        if (status != LearningPlanStatus.ACTIVE) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "only active plans can pause");
        }
        return copy(LearningPlanStatus.PAUSED, tasks, now);
    }

    public LearningPlan cancel(Instant now) {
        if (status == LearningPlanStatus.COMPLETED || status == LearningPlanStatus.CANCELLED) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "completed/cancelled plans cannot be cancelled again");
        }
        return copy(LearningPlanStatus.CANCELLED, tasks, now);
    }

    public LearningPlan completeTask(long taskId, Instant now) {
        LearningTask existing = task(taskId);
        if (existing.status() == LearningTaskStatus.COMPLETED) {
            return this;
        }
        if (status != LearningPlanStatus.ACTIVE) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "tasks can only be completed on an active plan");
        }
        LearningTask updated = existing.complete(now);
        List<LearningTask> nextTasks = replace(updated);
        boolean allDone = nextTasks.stream().allMatch(t -> t.status() == LearningTaskStatus.COMPLETED);
        return copy(allDone ? LearningPlanStatus.COMPLETED : status, nextTasks, now);
    }

    public LearningPlan saveTaskProgress(long taskId, int progressPercent, Instant now) {
        LearningTask updated = task(taskId).saveProgress(progressPercent, now);
        return copy(status == LearningPlanStatus.DRAFT ? LearningPlanStatus.ACTIVE : status,
                replace(updated), now);
    }

    private LearningTask task(long taskId) {
        return tasks.stream().filter(task -> task.taskId() == taskId).findFirst()
                .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.TASK_NOT_FOUND,
                        "task is not part of the plan: " + taskId));
    }

    private List<LearningTask> replace(LearningTask updated) {
        return tasks.stream().map(task -> task.taskId() == updated.taskId() ? updated : task).toList();
    }

    private LearningPlan copy(LearningPlanStatus nextStatus, List<LearningTask> nextTasks, Instant now) {
        return new LearningPlan(planId, scope, targetId, goalCode, contentVersionId, contentEpoch,
                timeZoneId, dailyQuotaMinutes, nextStatus, version + 1, nextTasks, createdAt, now);
    }
}
