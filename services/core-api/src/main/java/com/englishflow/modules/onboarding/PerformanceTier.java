package com.englishflow.modules.onboarding;

public enum PerformanceTier {
    ULTRA,
    HIGH,
    MEDIUM,
    PERFORMANCE;

    public static PerformanceTier from(String value) {
        if (value == null || value.isBlank()) return HIGH;
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("performanceTier must be ULTRA, HIGH, MEDIUM, or PERFORMANCE");
        }
    }

    public String renderMode() {
        return switch (this) {
            case ULTRA, HIGH -> "WEBGL_3D";
            case MEDIUM -> "LIGHT_3D";
            case PERFORMANCE -> "SVG_2D";
        };
    }
}
