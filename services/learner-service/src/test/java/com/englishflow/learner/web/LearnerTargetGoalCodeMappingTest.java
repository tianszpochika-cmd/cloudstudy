package com.englishflow.learner.web;

import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.DailyStudyMinutes;
import com.englishflow.learner.domain.GoalType;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearningGoal;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LearnerTargetGoalCodeMappingTest {
    private static final Instant NOW = Instant.parse("2026-09-23T00:00:00Z");

    @Test
    void b9CodesRoundTripThroughExistingGoalTypes() {
        Map<String, GoalType> codes = Map.of(
                "FOUNDATION", GoalType.FOUNDATION,
                "COLLEGE_CET", GoalType.CET_4_6,
                "POSTGRADUATE_ENGLISH", GoalType.POSTGRADUATE,
                "WORKPLACE_DAILY", GoalType.WORKPLACE);

        codes.forEach((code, type) -> {
            assertEquals(type, LearnerHttpController.goalType(code));
            assertEquals(code, LearnerHttpController.toTarget(goal(type, Map.of()), 3).goalCode());
        });
    }

    @Test
    void legacyInputCodesAreAcceptedButResponsesUseB9Codes() {
        Map<String, String> aliases = Map.of(
                "ZERO_BASIS", "FOUNDATION",
                "CET_4_6", "COLLEGE_CET",
                "POSTGRADUATE", "POSTGRADUATE_ENGLISH",
                "WORKPLACE", "WORKPLACE_DAILY");

        aliases.forEach((legacy, b9) -> {
            GoalType type = LearnerHttpController.goalType(legacy);
            assertEquals(b9, LearnerHttpController.toTarget(goal(type, Map.of()), 3).goalCode());
        });
    }

    @Test
    void unknownAndAdminOnlyGoalsDoNotBecomePublicB9Targets() {
        assertThrows(LearnerDomainException.class, () -> LearnerHttpController.goalType(null));
        assertThrows(LearnerDomainException.class, () -> LearnerHttpController.goalType("LANGUAGE_CERT"));
        assertThrows(LearnerDomainException.class, () -> LearnerHttpController.goalType("OTHER"));
        assertThrows(LearnerDomainException.class,
                () -> LearnerHttpController.toTarget(
                        goal(GoalType.LANGUAGE_CERT, Map.of("examName", "DELF", "language", "fr-FR")), 3));
    }

    private static LearningGoal goal(GoalType type, Map<String, Object> fields) {
        return new LearningGoal(7L, type, DailyStudyMinutes.FIFTEEN, null, CefrLevel.A1, fields, NOW);
    }
}
