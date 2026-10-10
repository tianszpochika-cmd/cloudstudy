package com.englishflow.learning.domain;

import java.util.List;
import java.util.Map;

/** Due reviews stay on today's list. Minutes past the budget are postponed, not debt. */
public final class ReviewBudget {
    public static final int MINUTES_PER_ITEM = 5;
    public static final String DUE = "DUE";
    public static final String DEFERRED = "DEFERRED";
    public static final String DEFERRED_COPY = "今天排不下，已顺延，这不是欠账。";

    private ReviewBudget() {
    }

    public static int arrange(List<Map<String, Object>> items, int targetMinutes) {
        int budget = Math.max(0, targetMinutes);
        int used = 0;
        int deferred = 0;
        for (Map<String, Object> item : items) {
            if (used + MINUTES_PER_ITEM <= budget) {
                item.put("arrangement", DUE);
                used += MINUTES_PER_ITEM;
            } else {
                item.put("arrangement", DEFERRED);
                item.put("arrangementCopy", DEFERRED_COPY);
                deferred++;
            }
        }
        return deferred;
    }
}
