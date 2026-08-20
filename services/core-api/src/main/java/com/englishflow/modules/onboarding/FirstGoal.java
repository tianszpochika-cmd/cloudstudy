package com.englishflow.modules.onboarding;

import java.time.Instant;
import java.time.LocalDate;

public record FirstGoal(
        String goalId,
        long userId,
        TargetGoal targetGoal,
        ExamType examType,
        String startingCefrLevel,
        int dailyQuotaMinutes,
        String title,
        String successCriteria,
        LocalDate targetDate,
        GoalStatus status,
        Instant createdAt,
        Instant updatedAt
) {
    public FirstGoal {
        if (goalId == null || goalId.isBlank()) throw new IllegalArgumentException("goalId is required");
        if (userId <= 0) throw new IllegalArgumentException("userId must be positive");
        if (targetGoal == null || examType == null || status == null) throw new IllegalArgumentException("goal fields are required");
        if (!startingCefrLevel.matches("A1|A2|B1|B2|C1|C2")) throw new IllegalArgumentException("invalid starting CEFR level");
        DailyDuration.fromMinutes(dailyQuotaMinutes);
    }
}
