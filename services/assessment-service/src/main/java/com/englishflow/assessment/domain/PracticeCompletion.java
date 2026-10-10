package com.englishflow.assessment.domain;

/** One completion fact per session. Phase 1 does not surface a reward. */
public final class PracticeCompletion {
    public static final String EVENT = "learning.practice.completed.v1";

    private PracticeCompletion() {
    }

    public static String dedupeKey(String sessionId) {
        return "practice-complete:" + (sessionId == null ? "" : sessionId);
    }

    public static boolean rewardVisible() {
        return false;
    }
}
