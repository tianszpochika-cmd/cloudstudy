package com.englishflow.learning.domain;

public enum ReviewConfidence {
    CERTAIN,
    FUZZY,
    GUESSED,
    UNKNOWN;

    public int capQuality(int quality) {
        return switch (this) {
            case CERTAIN -> quality;
            case FUZZY -> Math.min(quality, 3);
            case GUESSED -> Math.min(quality, 2);
            case UNKNOWN -> Math.min(quality, 1);
        };
    }
}
