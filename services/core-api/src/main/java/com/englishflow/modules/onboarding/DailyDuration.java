package com.englishflow.modules.onboarding;

import java.util.Arrays;

public enum DailyDuration {
    FIVE(5, 10),
    FIFTEEN(15, 30),
    THIRTY(30, 60),
    FORTY_FIVE(45, 100);

    private final int minutes;
    private final int xp;

    DailyDuration(int minutes, int xp) {
        this.minutes = minutes;
        this.xp = xp;
    }

    public int minutes() {
        return minutes;
    }

    public int xp() {
        return xp;
    }

    public static DailyDuration fromMinutes(Integer minutes) {
        if (minutes == null) {
            throw new IllegalArgumentException("dailyQuotaMinutes is required");
        }
        return Arrays.stream(values())
                .filter(duration -> duration.minutes == minutes)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("dailyQuotaMinutes must be 5, 15, 30, or 45"));
    }
}
