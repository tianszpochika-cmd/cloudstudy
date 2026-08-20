package com.englishflow.modules.onboarding;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DailyTaskPlan(
        long userId,
        LocalDate localDate,
        String goalId,
        int targetMinutes,
        int completedMinutes,
        int progressPercent,
        List<DailyTask> tasks,
        long planVersion,
        boolean reordered,
        Instant generatedAt
) {
    public DailyTaskPlan {
        if (userId <= 0 || localDate == null || targetMinutes <= 0 || completedMinutes < 0) {
            throw new IllegalArgumentException("invalid daily task plan");
        }
        if (progressPercent < 0 || progressPercent > 100) throw new IllegalArgumentException("progressPercent must be 0..100");
        tasks = tasks == null ? List.of() : List.copyOf(tasks);
    }
}
