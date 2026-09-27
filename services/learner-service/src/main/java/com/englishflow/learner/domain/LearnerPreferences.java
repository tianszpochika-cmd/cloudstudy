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
        java.util.List<Integer> weeklyStudyDays,
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
        if (weeklyStudyDays != null) {
            java.util.Set<Integer> distinct = new java.util.HashSet<>(weeklyStudyDays);
            if (weeklyStudyDays.isEmpty() || weeklyStudyDays.size() > 7 || distinct.size() != weeklyStudyDays.size()
                    || distinct.stream().anyMatch(day -> day == null || day < 1 || day > 7)) {
                throw new LearnerDomainException(LearnerDecisionCode.INVALID_PREFERENCE,
                        "weeklyStudyDays must hold 1..7 distinct days");
            }
            weeklyStudyDays = java.util.List.copyOf(weeklyStudyDays.stream().sorted().toList());
        }
        Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    public static LearnerPreferences defaults(Instant now) {
        return new LearnerPreferences("zh-CN", "en-US", ThemeMode.SYSTEM, "Asia/Shanghai", false, null, now);
    }

    /** Effective study days: stored preference or the documented daily default. */
    public java.util.List<Integer> effectiveStudyDays() {
        return weeklyStudyDays == null ? java.util.List.of(1, 2, 3, 4, 5, 6, 7) : weeklyStudyDays;
    }

    private static void requireLocale(String value, String field) {
        if (value == null || !LOCALE.matcher(value).matches()) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PREFERENCE,
                    field + " has an invalid locale format");
        }
    }
}
