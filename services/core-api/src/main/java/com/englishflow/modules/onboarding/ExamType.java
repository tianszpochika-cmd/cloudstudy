package com.englishflow.modules.onboarding;

public enum ExamType {
    NONE,
    CET4,
    CET6,
    POSTGRADUATE,
    IELTS,
    TOEFL;

    public static ExamType from(String value) {
        if (value == null || value.isBlank()) {
            return NONE;
        }
        String normalized = value.trim().toUpperCase().replace('-', '_');
        if (normalized.equals("CET_4")) normalized = "CET4";
        if (normalized.equals("CET_6")) normalized = "CET6";
        try {
            return valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("examType is not supported");
        }
    }
}
