package com.englishflow.modules.onboarding;

import java.time.Instant;
import java.time.LocalDate;

public record DailyTask(
        String taskId,
        long userId,
        LocalDate localDate,
        TaskType taskType,
        String title,
        int estimatedMinutes,
        int quantity,
        int priority,
        String reasonCode,
        int sequence,
        TaskStatus status,
        Instant completedAt
) {
    public DailyTask {
        if (taskId == null || taskId.isBlank()) throw new IllegalArgumentException("taskId is required");
        if (userId <= 0 || localDate == null || taskType == null || status == null) throw new IllegalArgumentException("task fields are required");
        if (estimatedMinutes <= 0 || quantity < 0 || priority < 0 || sequence < 0) throw new IllegalArgumentException("invalid task metrics");
    }

    public DailyTask withStatus(TaskStatus nextStatus, Instant completedAtValue) {
        return new DailyTask(taskId, userId, localDate, taskType, title, estimatedMinutes, quantity,
                priority, reasonCode, sequence, nextStatus, completedAtValue);
    }

    public DailyTask withSequence(int nextSequence, int nextPriority) {
        return new DailyTask(taskId, userId, localDate, taskType, title, estimatedMinutes, quantity,
                nextPriority, reasonCode, nextSequence, status, completedAt);
    }
}
