package com.englishflow.learner.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * User preferences. UI locale and content locale remain separate facts so changing learning
 * language cannot silently change the product UI language.
 */
public record LearnerPreferences(
        String uiLocale,
        String contentLocale,
        ThemeMode themeMode,
        String timezone,
        boolean reducedMotion,
        Instant updatedAt) {

    private static final Pattern LOCALE = Pattern.compile("[a-z]{2,3}-[A-Z]{2,3}");
    private static final Pattern TIMEZONE = Pattern.compile("[A-Za-z0-9_+./:-]{1,64}");

    public LearnerPreferences {
        requireLocale(uiLocale, "uiLocale");
        requireLocale(contentLocale, "contentLocale");
        Objects.requireNonNull(themeMode, "themeMode is required");
        if (timezone == null || !TIMEZONE.matcher(timezone).matches()) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PREFERENCE,
                    "timezone has an invalid format");
        }
        Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    public static LearnerPreferences defaults(Instant now) {
        return new LearnerPreferences("zh-CN", "en-US", ThemeMode.SYSTEM, "Asia/Shanghai", false, now);
    }

    private static void requireLocale(String value, String field) {
        if (value == null || !LOCALE.matcher(value).matches()) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PREFERENCE,
                    field + " has an invalid locale format");
        }
    }
}
