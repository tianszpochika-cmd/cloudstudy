package com.englishflow.assessment.domain;

/**
 * Resume stays on the last answer the server has accepted.
 * A retired pin stops loading and offers another way back.
 */
public final class PracticeCheckpoint {
    public static final String OFFLINE_EXIT = "内容已下线，已停止加载。可以回到可用学习。";

    public record Resume(int index, String copy, boolean stopped) {
    }

    private PracticeCheckpoint() {
    }

    public static Resume resume(int received, boolean contentAvailable) {
        if (!contentAvailable) return new Resume(0, OFFLINE_EXIT, true);
        int confirmed = Math.max(0, received);
        int index = confirmed == 0 ? 1 : confirmed;
        return new Resume(index, "上次学到第 " + index + " 题，继续", false);
    }

    /** A client cursor cannot move past answers the server has already received. */
    public static int clampCursor(int received, int requested) {
        return Math.min(Math.max(0, received), Math.max(0, requested));
    }
}
