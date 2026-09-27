package com.englishflow.learner.application;

import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.LearnerPreferences;
import com.englishflow.learner.domain.ThemeMode;

import java.time.Instant;
import java.util.Objects;

/** DTO seam for explicit UI/content locale and theme preference synchronization. */
public record UpdateLearnerPreferencesCommand(
        String uiLocale,
        String contentLocale,
        ThemeMode themeMode,
        String timezone,
        boolean reducedMotion,
        java.util.List<Integer> weeklyStudyDays,
        IdempotencyKey idempotencyKey,
        Long expectedVersion) {

    public UpdateLearnerPreferencesCommand {
        Objects.requireNonNull(uiLocale, "uiLocale is required");
        Objects.requireNonNull(contentLocale, "contentLocale is required");
        Objects.requireNonNull(themeMode, "themeMode is required");
        Objects.requireNonNull(timezone, "timezone is required");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey is required");
        if (expectedVersion != null && expectedVersion < 0) {
            throw new IllegalArgumentException("expectedVersion cannot be negative");
        }
    }

    public UpdateLearnerPreferencesCommand(
            String uiLocale,
            String contentLocale,
            ThemeMode themeMode,
            String timezone,
            boolean reducedMotion,
            IdempotencyKey idempotencyKey) {
        this(uiLocale, contentLocale, themeMode, timezone, reducedMotion, null, idempotencyKey, null);
    }

    public LearnerPreferences toPreferences(Instant now) {
        return new LearnerPreferences(uiLocale, contentLocale, themeMode, timezone, reducedMotion,
                weeklyStudyDays, now);
    }

    public String fingerprint() {
        return String.join("|", "preferences", uiLocale, contentLocale, themeMode.name(), timezone,
                Boolean.toString(reducedMotion), String.valueOf(weeklyStudyDays),
                String.valueOf(expectedVersion));
    }
}
