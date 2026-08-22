package com.englishflow.learner.application;

import com.englishflow.learner.domain.LearnerPrincipalContext;

/** Application port that a future Gateway controller/contract adapter will call. */
public interface LearnerProfileCommandPort {

    MutationResult<LearnerProfileView> updateProfile(
            LearnerPrincipalContext context,
            UpdateLearnerProfileCommand command,
            RequestMetadata metadata);

    MutationResult<LearnerProfileView> setLearningGoal(
            LearnerPrincipalContext context,
            SetLearningGoalCommand command,
            RequestMetadata metadata);

    MutationResult<LearnerProfileView> updatePreferences(
            LearnerPrincipalContext context,
            UpdateLearnerPreferencesCommand command,
            RequestMetadata metadata);
}
