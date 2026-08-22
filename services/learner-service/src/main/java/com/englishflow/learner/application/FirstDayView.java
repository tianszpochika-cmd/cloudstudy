package com.englishflow.learner.application;

import com.englishflow.learner.domain.AssessmentState;
import com.englishflow.learner.domain.FirstDayProjection;
import com.englishflow.learner.domain.LearnerPreferences;
import com.englishflow.learner.domain.LearningGoal;
import com.englishflow.learner.domain.OnboardingState;
import com.englishflow.learner.domain.ProfileSource;

import java.time.Instant;
import java.util.Optional;

/** Bounded first-day/home DTO. Content details and learning plan facts come from their owners. */
public record FirstDayView(
        String profileId,
        String tenantId,
        String subjectId,
        ProfileSource source,
        OnboardingState onboardingState,
        AssessmentState assessmentState,
        Optional<LearningGoal> goal,
        Optional<LearnerPreferences> preferences,
        int todayNewItems,
        int dueReviewItems,
        int weakItems,
        int completionPercent,
        String nextAction,
        Optional<String> resumeTarget,
        long profileVersion,
        Instant generatedAt) {

    public static FirstDayView from(FirstDayProjection projection) {
        return new FirstDayView(projection.profileId(), projection.scope().tenantId(),
                projection.scope().subjectId(), projection.source(), projection.onboardingState(),
                projection.assessmentState(), projection.goal(), projection.preferences(),
                projection.todayNewItems(), projection.dueReviewItems(), projection.weakItems(),
                projection.completionPercent(), projection.nextAction(), projection.resumeTarget(),
                projection.profileVersion(), projection.generatedAt());
    }
}
