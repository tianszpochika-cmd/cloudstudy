package com.englishflow.learner.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Read-only first-day/home projection owned by learner-service.
 * Counts are projections supplied by later learning/assessment services; this object never
 * contains answer rules, question payloads or writable plan state.
 */
public record FirstDayProjection(
        LearnerTenantScope scope,
        String profileId,
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

    public FirstDayProjection {
        Objects.requireNonNull(scope, "scope is required");
        Objects.requireNonNull(profileId, "profileId is required");
        Objects.requireNonNull(source, "source is required");
        Objects.requireNonNull(onboardingState, "onboardingState is required");
        Objects.requireNonNull(assessmentState, "assessmentState is required");
        goal = goal == null ? Optional.empty() : goal;
        preferences = preferences == null ? Optional.empty() : preferences;
        requireCount(todayNewItems, "todayNewItems");
        requireCount(dueReviewItems, "dueReviewItems");
        requireCount(weakItems, "weakItems");
        if (completionPercent < 0 || completionPercent > 100) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE,
                    "completionPercent must be between 0 and 100");
        }
        if (nextAction == null || !nextAction.matches("[a-z][a-z0-9._/-]{0,127}")) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE,
                    "nextAction has an invalid format");
        }
        resumeTarget = resumeTarget == null ? Optional.empty() : resumeTarget;
        if (profileVersion < 0) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE,
                    "profileVersion cannot be negative");
        }
        Objects.requireNonNull(generatedAt, "generatedAt is required");
    }

    public boolean containsAnswerRules() {
        return false;
    }

    public static FirstDayProjection from(LearnerProfile profile, Instant now) {
        Objects.requireNonNull(profile, "profile is required");
        String nextAction = switch (profile.onboardingState()) {
            case NOT_STARTED -> "onboarding.select-goal";
            case DRAFT -> "onboarding.resume";
            case ASSESSMENT_IN_PROGRESS -> "onboarding.resume-assessment";
            case ASSESSMENT_COMPLETED -> "onboarding.review-assessment";
            case COMPLETED -> "learn.home";
        };
        int completion = switch (profile.onboardingState()) {
            case NOT_STARTED -> 0;
            case DRAFT, ASSESSMENT_IN_PROGRESS -> 25;
            case ASSESSMENT_COMPLETED -> 75;
            case COMPLETED -> 100;
        };
        return new FirstDayProjection(profile.scope(), profile.profileId(), profile.source(),
                profile.onboardingState(), profile.assessmentState(), profile.goal(), profile.preferences(),
                0, 0, 0, completion, nextAction, Optional.ofNullable(profile.resumeTarget()),
                profile.version(), now);
    }

    private static void requireCount(int value, String field) {
        if (value < 0) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE,
                    field + " cannot be negative");
        }
    }
}
