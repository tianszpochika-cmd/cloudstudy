package com.englishflow.learning.domain;

import java.time.Instant;

/** Pure result of one deterministic SM-2 calculation; it does not mutate a fact. */
public record Sm2ReviewResult(
        SrsStage beforeStage,
        SrsStage afterStage,
        int rawQuality,
        int effectiveQuality,
        double easinessFactor,
        int repetitions,
        int intervalDays,
        int lapseCount,
        Instant dueAt,
        Instant reviewedAt,
        int nextStateVersion) {

    public Sm2ReviewResult {
        if (rawQuality < 0 || rawQuality > 3 || effectiveQuality < 0 || effectiveQuality > 3) {
            throw new IllegalArgumentException("quality must be between 0 and 3");
        }
        if (easinessFactor < 1.3 || repetitions < 0 || intervalDays < 1 || lapseCount < 0) {
            throw new IllegalArgumentException("SM-2 result contains invalid values");
        }
        if (nextStateVersion < 1) {
            throw new IllegalArgumentException("nextStateVersion must be positive");
        }
    }
}
