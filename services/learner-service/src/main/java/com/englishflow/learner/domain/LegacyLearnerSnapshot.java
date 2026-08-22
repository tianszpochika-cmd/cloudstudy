package com.englishflow.learner.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

/**
 * Read-only shape exposed by the v1/core-api migration adapter.
 * There is deliberately no write method or back-reference to a legacy repository.
 */
public record LegacyLearnerSnapshot(
        String tenantId,
        String ownerId,
        String profileId,
        GoalType goalType,
        DailyStudyMinutes dailyStudyMinutes,
        LocalDate targetDate,
        CefrLevel startingLevel,
        String uiLocale,
        String contentLocale,
        ThemeMode themeMode,
        String timezone,
        Boolean reducedMotion,
        OnboardingState onboardingState,
        AssessmentState assessmentState,
        String resumeTarget,
        long version,
        Instant updatedAt) {

    public LegacyLearnerSnapshot {
        requireId(tenantId, "tenantId");
        requireId(ownerId, "ownerId");
        requireId(profileId, "profileId");
        if ((goalType == null) != (dailyStudyMinutes == null)) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_LEGACY_SNAPSHOT,
                    "legacy goal fields must be supplied together");
        }
        if (hasAnyPreference() && (uiLocale == null || contentLocale == null || themeMode == null
                || timezone == null || reducedMotion == null)) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_LEGACY_SNAPSHOT,
                    "legacy preference fields are incomplete");
        }
        onboardingState = onboardingState == null ? OnboardingState.NOT_STARTED : onboardingState;
        assessmentState = assessmentState == null ? AssessmentState.NOT_STARTED : assessmentState;
        if (version < 0) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_LEGACY_SNAPSHOT,
                    "legacy version cannot be negative");
        }
        Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    private boolean hasAnyPreference() {
        return uiLocale != null || contentLocale != null || themeMode != null || timezone != null
                || reducedMotion != null;
    }

    private static void requireId(String value, String field) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_LEGACY_SNAPSHOT,
                    field + " has an invalid format");
        }
    }
}
