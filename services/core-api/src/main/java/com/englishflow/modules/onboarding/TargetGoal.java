package com.englishflow.modules.onboarding;

public enum TargetGoal {
    ZERO_BASIS,
    CET_4_6,
    POSTGRADUATE,
    WORKPLACE_DAILY;

    public static TargetGoal from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("targetGoal is required");
        }
        try {
            return valueOf(value.trim().toUpperCase().replace('-', '_'));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("targetGoal is not supported");
        }
    }
}
