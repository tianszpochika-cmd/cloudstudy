package com.englishflow.gamification.application;

/** Monotonic, non-negative server-side XP level projection. */
public final class LevelPolicy {

    private LevelPolicy() {
    }

    public static long threshold(int level) {
        if (level < 1) {
            throw new IllegalArgumentException("level must be positive");
        }
        return 50L * (level - 1L) * level;
    }

    public static int levelFor(long xp) {
        if (xp < 0) {
            throw new IllegalArgumentException("xp cannot be negative");
        }
        int level = 1;
        while (level < 10_000 && threshold(level + 1) <= xp) {
            level++;
        }
        return level;
    }
}
