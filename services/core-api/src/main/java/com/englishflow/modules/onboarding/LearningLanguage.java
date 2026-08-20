package com.englishflow.modules.onboarding;

/** Phase 1 currently supports English as the target learning language. */
public enum LearningLanguage {
    ENGLISH;

    public static LearningLanguage from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("language is required");
        }
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("language must be ENGLISH");
        }
    }
}
