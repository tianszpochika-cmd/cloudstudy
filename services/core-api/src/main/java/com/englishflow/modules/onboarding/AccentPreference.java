package com.englishflow.modules.onboarding;

public enum AccentPreference {
    US,
    UK,
    NEUTRAL;

    public static AccentPreference from(String value) {
        if (value == null || value.isBlank()) return NEUTRAL;
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("accentPreference must be US, UK, or NEUTRAL");
        }
    }
}
