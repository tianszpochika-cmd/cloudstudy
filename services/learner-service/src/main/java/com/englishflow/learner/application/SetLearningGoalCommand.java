package com.englishflow.learner.application;

import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.DailyStudyMinutes;
import com.englishflow.learner.domain.GoalType;
import com.englishflow.learner.domain.IdempotencyKey;

import java.time.LocalDate;
import java.util.Objects;

/** DTO seam for adult onboarding goal selection. */
public record SetLearningGoalCommand(
        GoalType goalType,
        DailyStudyMinutes dailyStudyMinutes,
        LocalDate targetDate,
        CefrLevel startingLevel,
        IdempotencyKey idempotencyKey,
        Long expectedVersion) {

    public SetLearningGoalCommand {
        Objects.requireNonNull(goalType, "goalType is required");
        Objects.requireNonNull(dailyStudyMinutes, "dailyStudyMinutes is required");
        Objects.requireNonNull(startingLevel, "targetLevel is required");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey is required");
        if (expectedVersion != null && expectedVersion < 0) {
            throw new IllegalArgumentException("expectedVersion cannot be negative");
        }
    }

    public SetLearningGoalCommand(
            GoalType goalType,
            DailyStudyMinutes dailyStudyMinutes,
            LocalDate targetDate,
            CefrLevel startingLevel,
            IdempotencyKey idempotencyKey) {
        this(goalType, dailyStudyMinutes, targetDate, startingLevel, idempotencyKey, null);
    }

    public String fingerprint() {
        return String.join("|", "goal", goalType.name(), dailyStudyMinutes.name(),
                String.valueOf(targetDate), String.valueOf(startingLevel), String.valueOf(expectedVersion));
    }
}
