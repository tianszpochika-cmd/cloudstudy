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
        IdempotencyKey idempotencyKey) {

    public UpdateLearnerPreferencesCommand {
        Objects.requireNonNull(uiLocale, "uiLocale is required");
        Objects.requireNonNull(contentLocale, "contentLocale is required");
        Objects.requireNonNull(themeMode, "themeMode is required");
        Objects.requireNonNull(timezone, "timezone is required");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey is required");
    }

    public LearnerPreferences toPreferences(Instant now) {
        return new LearnerPreferences(uiLocale, contentLocale, themeMode, timezone, reducedMotion, now);
    }

    public String fingerprint() {
        return String.join("|", "preferences", uiLocale, contentLocale, themeMode.name(), timezone,
                Boolean.toString(reducedMotion));
    }
}
