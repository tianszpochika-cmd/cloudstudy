package com.englishflow.learning.domain;

import java.util.Set;

/** Phase 1 daily study quota shared by learner targets and learning plans. */
public final class DailyQuotaMinutes {

    private static final Set<Integer> ALLOWED = Set.of(5, 15, 30, 45);

    private DailyQuotaMinutes() {
    }

    public static int require(int minutes) {
        if (!ALLOWED.contains(minutes)) {
            throw new IllegalArgumentException(
                    "dailyQuotaMinutes must be one of 5, 15, 30, or 45");
        }
        return minutes;
    }
}
