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
        IdempotencyKey idempotencyKey) {

    public SetLearningGoalCommand {
        Objects.requireNonNull(goalType, "goalType is required");
        Objects.requireNonNull(dailyStudyMinutes, "dailyStudyMinutes is required");
        Objects.requireNonNull(startingLevel, "targetLevel is required");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey is required");
    }

    public String fingerprint() {
        return String.join("|", "goal", goalType.name(), dailyStudyMinutes.name(),
                String.valueOf(targetDate), String.valueOf(startingLevel));
    }
}
