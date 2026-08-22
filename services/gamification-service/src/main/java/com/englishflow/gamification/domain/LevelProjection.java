package com.englishflow.gamification.domain;

/** Monotonic level projection derived from the XP ledger balance. */
public record LevelProjection(int level, long floorXp, long nextLevelXp, long progressXp) {

    private static final long[] THRESHOLDS = {0, 100, 300, 600, 1_000, 1_500, 2_200, 3_000};

    public static LevelProjection fromXp(long xp) {
        if (xp < 0) {
            throw new GamificationDomainException(GamificationDomainException.Code.LEDGER_INVARIANT,
                    "XP balance cannot be negative");
        }
        int level = 1;
        for (int index = 0; index < THRESHOLDS.length; index++) {
            if (xp >= THRESHOLDS[index]) {
                level = index + 1;
            } else {
                break;
            }
        }
        long floor = threshold(level);
        long next = level < THRESHOLDS.length ? threshold(level + 1) : floor + 1_000L;
        return new LevelProjection(level, floor, next, xp - floor);
    }

    public static long threshold(int level) {
        if (level < 1) {
            throw new IllegalArgumentException("level must be positive");
        }
        if (level <= THRESHOLDS.length) {
            return THRESHOLDS[level - 1];
        }
        long last = THRESHOLDS[THRESHOLDS.length - 1];
        return last + (long) (level - THRESHOLDS.length) * 1_000L;
    }
}
