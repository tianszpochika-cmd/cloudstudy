package com.englishflow.learner.domain;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

/** Validated adult learning goal; plan/SRS facts remain owned by learning-service. */
public record LearningGoal(
        long targetId,
        GoalType type,
        DailyStudyMinutes dailyStudyMinutes,
        LocalDate targetDate,
        CefrLevel startingLevel,
        Instant updatedAt) {

    public LearningGoal {
        if (targetId < 0) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                    "target id cannot be negative");
        }
        Objects.requireNonNull(type, "goal type is required");
        Objects.requireNonNull(dailyStudyMinutes, "daily study minutes are required");
        Objects.requireNonNull(updatedAt, "updatedAt is required");
        if (targetDate != null && targetDate.isBefore(LocalDate.of(2020, 1, 1))) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                    "target date is outside the supported product range");
        }
    }

    public static LearningGoal create(
            long targetId,
            GoalType type,
            DailyStudyMinutes dailyStudyMinutes,
            LocalDate targetDate,
            CefrLevel startingLevel,
            Clock clock) {
        Objects.requireNonNull(clock, "clock is required");
        if (targetId < 1) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                    "target id must be positive for an owned goal");
        }
        if (targetDate != null && targetDate.isBefore(LocalDate.now(clock))) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                    "target date cannot be in the past");
        }
        Objects.requireNonNull(startingLevel, "target level is required");
        return new LearningGoal(targetId, type, dailyStudyMinutes, targetDate, startingLevel, clock.instant());
    }

    /** Compatibility constructor for read-only legacy shadows whose database id is unknown. */
    public LearningGoal(
            GoalType type,
            DailyStudyMinutes dailyStudyMinutes,
            java.time.LocalDate targetDate,
            CefrLevel startingLevel,
            Instant updatedAt) {
        this(0L, type, dailyStudyMinutes, targetDate, startingLevel, updatedAt);
    }
}
