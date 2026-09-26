package com.englishflow.learner.web;

import com.englishflow.learner.application.FirstDayView;
import com.englishflow.learner.domain.AssessmentState;
import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.DailyStudyMinutes;
import com.englishflow.learner.domain.GoalType;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearningGoal;
import com.englishflow.learner.domain.OnboardingState;
import com.englishflow.learner.domain.ProfileSource;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LearnerFirstDayHttpMappingTest {
    private static final Instant NOW = Instant.parse("2026-09-23T00:00:00Z");

    @Test
    void missingTargetHasAnExplicitNotReadyBlocker() {
        LearnerHttpController.FirstDayData data = LearnerHttpController.toFirstDay(view(Optional.empty())).data();

        assertEquals("NOT_READY", data.state());
        assertEquals("TARGET_INCOMPLETE", data.blocker());
        assertEquals(0, data.taskCount());
        assertTrue(data.tasks().isEmpty());
        assertEquals("learner-profile:2", data.projectionWatermark());
    }

    @Test
    void confirmedTargetWithoutPlanningFactsCannotClaimReady() {
        LearningGoal goal = new LearningGoal(7L, GoalType.FOUNDATION, DailyStudyMinutes.FIFTEEN,
                null, CefrLevel.A1, Map.of(), NOW);

        LearnerDomainException failure = assertThrows(LearnerDomainException.class,
                () -> LearnerHttpController.toFirstDay(view(Optional.of(goal))));

        assertEquals(LearnerDecisionCode.STORE_FAILURE, failure.code());
        assertTrue(failure.retryable());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                new LearnerHttpExceptionHandler().domain(failure).getStatusCode());
    }

    private static FirstDayView view(Optional<LearningGoal> goal) {
        return new FirstDayView("profile:test", "platform", "test", ProfileSource.OWNED,
                OnboardingState.DRAFT, AssessmentState.NOT_STARTED, goal, Optional.empty(),
                0, 0, 0, 25, "onboarding.resume", Optional.empty(), 2, NOW);
    }
}
