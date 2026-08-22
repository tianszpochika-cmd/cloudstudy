package com.englishflow.learner.application;

import com.englishflow.learner.domain.AssessmentState;
import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.OnboardingState;

import java.util.Objects;

/** DTO seam for profile/onboarding state updates; subject/tenant/owner are never client fields. */
public record UpdateLearnerProfileCommand(
        OnboardingState onboardingState,
        AssessmentState assessmentState,
        CefrLevel currentLevel,
        String resumeTarget,
        IdempotencyKey idempotencyKey) {

    public UpdateLearnerProfileCommand {
        Objects.requireNonNull(onboardingState, "onboardingState is required");
        Objects.requireNonNull(assessmentState, "assessmentState is required");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey is required");
    }

    public String fingerprint() {
        return String.join("|", "profile", onboardingState.name(), assessmentState.name(),
                String.valueOf(currentLevel), String.valueOf(resumeTarget));
    }
}
