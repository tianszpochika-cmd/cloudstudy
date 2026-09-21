package com.englishflow.learner.domain;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/** Validated adult learning goal; plan/SRS facts remain owned by learning-service. */
public record LearningGoal(
        long targetId,
        GoalType type,
        DailyStudyMinutes dailyStudyMinutes,
        LocalDate targetDate,
        CefrLevel startingLevel,
        Map<String, Object> fields,
        Instant updatedAt) {

    /** BCP-47 exam-language subset shared with the admin contract. */
    private static final Pattern LANGUAGE = Pattern.compile("[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?");

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
        fields = fields == null ? Map.of() : Map.copyOf(fields);
        if (type == GoalType.LANGUAGE_CERT) {
            requireExamField(fields.get("examName"), "examName");
            Object language = fields.get("language");
            if (!(language instanceof String tag) || tag.length() > 16 || !LANGUAGE.matcher(tag).matches()) {
                throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                        "LANGUAGE_CERT goals require a BCP-47 language such as fr-FR or de-DE");
            }
        } else if (!fields.isEmpty()) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                    "only LANGUAGE_CERT goals carry exam fields");
        }
    }

    public static LearningGoal create(
            long targetId,
            GoalType type,
            DailyStudyMinutes dailyStudyMinutes,
            LocalDate targetDate,
            CefrLevel startingLevel,
            Map<String, Object> fields,
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
        return new LearningGoal(targetId, type, dailyStudyMinutes, targetDate, startingLevel, fields,
                clock.instant());
    }

    /** Compatibility constructor for read-only legacy shadows whose database id is unknown. */
    public LearningGoal(
            GoalType type,
            DailyStudyMinutes dailyStudyMinutes,
            java.time.LocalDate targetDate,
            CefrLevel startingLevel,
            Instant updatedAt) {
        this(0L, type, dailyStudyMinutes, targetDate, startingLevel, Map.of(), updatedAt);
    }

    private static void requireExamField(Object value, String field) {
        if (!(value instanceof String text) || text.isBlank() || text.length() > 128) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                    "LANGUAGE_CERT goals require " + field + " of 1..128 characters");
        }
    }
}
