package com.englishflow.learner.application;

import com.englishflow.learner.domain.AssessmentState;
import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.LearnerPreferences;
import com.englishflow.learner.domain.LearnerProfile;
import com.englishflow.learner.domain.LearningGoal;
import com.englishflow.learner.domain.OnboardingState;
import com.englishflow.learner.domain.ProfileSource;

import java.time.Instant;
import java.util.Optional;

/** Read DTO; it exposes no token, policy, answer rule or database implementation detail. */
public record LearnerProfileView(
        String profileId,
        String tenantId,
        String subjectId,
        ProfileSource source,
        OnboardingState onboardingState,
        AssessmentState assessmentState,
        Optional<CefrLevel> currentLevel,
        Optional<LearningGoal> goal,
        Optional<LearnerPreferences> preferences,
        String resumeTarget,
        long version,
        Instant updatedAt) {

    public static LearnerProfileView from(LearnerProfile profile) {
        return new LearnerProfileView(profile.profileId(), profile.scope().tenantId(),
                profile.scope().subjectId(), profile.source(), profile.onboardingState(),
                profile.assessmentState(), profile.currentLevel(), profile.goal(), profile.preferences(),
                profile.resumeTarget(), profile.version(), profile.updatedAt());
    }
}
