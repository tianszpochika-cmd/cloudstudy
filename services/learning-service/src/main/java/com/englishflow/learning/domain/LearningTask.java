package com.englishflow.learning.domain;

import java.time.LocalDate;
import java.time.Instant;
import java.util.Objects;

/** One plan task; assessment/content facts are referenced by id and never copied into this fact. */
public record LearningTask(
        long taskId,
        LearningTaskType taskType,
        long contentItemId,
        long contentVersionId,
        LocalDate plannedLocalDate,
        LearningTaskStatus status,
        int progressPercent,
        int completionVersion,
        Instant lastUpdatedAt) {

    public LearningTask {
        if (taskId < 1 || contentItemId < 1 || contentVersionId < 1) {
            throw new IllegalArgumentException("task and content identifiers must be positive");
        }
        Objects.requireNonNull(taskType, "taskType is required");
        Objects.requireNonNull(plannedLocalDate, "plannedLocalDate is required");
        Objects.requireNonNull(status, "status is required");
        if (progressPercent < 0 || progressPercent > 100 || completionVersion < 0) {
            throw new IllegalArgumentException("task progress is invalid");
        }
        Objects.requireNonNull(lastUpdatedAt, "lastUpdatedAt is required");
    }

    public static LearningTask planned(long taskId, LearningTaskType type, long itemId,
            long versionId, LocalDate localDate, Instant now) {
        return new LearningTask(taskId, type, itemId, versionId, localDate,
                LearningTaskStatus.PLANNED, 0, 0, now);
    }

    public LearningTask saveProgress(int nextProgressPercent, Instant now) {
        if (status == LearningTaskStatus.COMPLETED
                || status == LearningTaskStatus.SKIPPED
                || status == LearningTaskStatus.EXPIRED) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "completed/cancelled task cannot receive progress");
        }
        if (nextProgressPercent < progressPercent || nextProgressPercent > 100) {
            throw new LearningDomainException(LearningDecisionCode.PROGRESS_INVALID,
                    "task progress cannot move backwards or exceed 100");
        }
        LearningTaskStatus nextStatus = nextProgressPercent == 0
                ? status : LearningTaskStatus.IN_PROGRESS;
        return new LearningTask(taskId, taskType, contentItemId, contentVersionId, plannedLocalDate,
                nextStatus, nextProgressPercent, completionVersion, now);
    }

    public LearningTask complete(Instant now) {
        if (status == LearningTaskStatus.COMPLETED) {
            return this;
        }
        if (status == LearningTaskStatus.SKIPPED || status == LearningTaskStatus.EXPIRED) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "skipped/expired task cannot be completed");
        }
        return new LearningTask(taskId, taskType, contentItemId, contentVersionId, plannedLocalDate,
                LearningTaskStatus.COMPLETED, 100, completionVersion + 1, now);
    }
}
