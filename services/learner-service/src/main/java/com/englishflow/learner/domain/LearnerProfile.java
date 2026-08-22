package com.englishflow.learner.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/** Learner-service aggregate; it contains no IAM identity or learning-service plan facts. */
public record LearnerProfile(
        LearnerTenantScope scope,
        String profileId,
        ProfileSource source,
        OnboardingState onboardingState,
        AssessmentState assessmentState,
        Optional<CefrLevel> currentLevel,
        Optional<LearningGoal> goal,
        Optional<LearnerPreferences> preferences,
        String resumeTarget,
        long version,
        Instant createdAt,
        Instant updatedAt) {

    public LearnerProfile {
        Objects.requireNonNull(scope, "scope is required");
        requireId(profileId, "profileId");
        Objects.requireNonNull(source, "source is required");
        Objects.requireNonNull(onboardingState, "onboardingState is required");
        Objects.requireNonNull(assessmentState, "assessmentState is required");
        currentLevel = currentLevel == null ? Optional.empty() : currentLevel;
        goal = goal == null ? Optional.empty() : goal;
        preferences = preferences == null ? Optional.empty() : preferences;
        if (onboardingState == OnboardingState.COMPLETED && goal.isEmpty()) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE,
                    "completed onboarding requires a learning goal");
        }
        if (version < 0) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE,
                    "profile version cannot be negative");
        }
        Objects.requireNonNull(createdAt, "createdAt is required");
        Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    public static LearnerProfile empty(LearnerTenantScope scope, Instant now) {
        Objects.requireNonNull(now, "now is required");
        return new LearnerProfile(
                scope,
                "profile:" + scope.subjectId(),
                ProfileSource.EMPTY,
                OnboardingState.NOT_STARTED,
                AssessmentState.NOT_STARTED,
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                null,
                0,
                now,
                now);
    }

    public LearnerProfile asOwned(Instant now) {
        if (source == ProfileSource.OWNED) {
            return this;
        }
        return new LearnerProfile(scope, profileId, ProfileSource.OWNED, onboardingState,
                assessmentState, currentLevel, goal, preferences, resumeTarget, 0, now, now);
    }

    public LearnerProfile withGoal(LearningGoal value, Instant now) {
        return next(source, OnboardingState.DRAFT, assessmentState, currentLevel,
                Optional.of(Objects.requireNonNull(value, "goal is required")), preferences, resumeTarget, now);
    }

    public LearnerProfile withPreferences(LearnerPreferences value, Instant now) {
        return next(source, onboardingState, assessmentState, currentLevel, goal,
                Optional.of(Objects.requireNonNull(value, "preferences are required")), resumeTarget, now);
    }

    public LearnerProfile withProfile(
            OnboardingState nextOnboardingState,
            AssessmentState nextAssessmentState,
            CefrLevel nextLevel,
            String nextResumeTarget,
            Instant now) {
        return next(source,
                Objects.requireNonNull(nextOnboardingState, "onboarding state is required"),
                Objects.requireNonNull(nextAssessmentState, "assessment state is required"),
                Optional.ofNullable(nextLevel), goal, preferences, nextResumeTarget, now);
    }

    private LearnerProfile next(
            ProfileSource nextSource,
            OnboardingState nextOnboardingState,
            AssessmentState nextAssessmentState,
            Optional<CefrLevel> nextLevel,
            Optional<LearningGoal> nextGoal,
            Optional<LearnerPreferences> nextPreferences,
            String nextResumeTarget,
            Instant now) {
        return new LearnerProfile(scope, profileId, nextSource, nextOnboardingState, nextAssessmentState,
                nextLevel, nextGoal, nextPreferences, normalizeResumeTarget(nextResumeTarget), version + 1,
                createdAt, Objects.requireNonNull(now, "now is required"));
    }

    private static String normalizeResumeTarget(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.length() > 256 || !value.matches("[A-Za-z0-9][A-Za-z0-9_./:-]{0,255}")) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE,
                    "resume target has an invalid format");
        }
        return value;
    }

    private static void requireId(String value, String field) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE,
                    field + " has an invalid format");
        }
    }
}
