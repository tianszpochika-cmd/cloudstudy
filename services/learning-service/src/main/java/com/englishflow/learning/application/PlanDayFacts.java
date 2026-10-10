package com.englishflow.learning.application;

/**
 * Server-owned sentences and empty-queue reasons for the plan-today loop.
 * Callers pass facts already verified by learning-service. This type does not
 * read the clock, the account age, or a client-supplied explanation.
 */
public final class PlanDayFacts {

    private PlanDayFacts() {
    }

    /**
     * One sentence from the goal, the daily minutes and the placement result
     * kind. A skipped baseline must not sound like a measured level. The
     * sentence is stored with the snapshot and is not recomputed from later
     * configuration.
     */
    public static String explanation(String goalCode, int dailyMinutes, String resultKind) {
        if ("SKIPPED".equals(resultKind)) {
            return "初始安排，后续按练习调整";
        }
        int minutes = Math.max(0, dailyMinutes);
        return "根据目标「" + goalLabel(goalCode) + "」和每日 " + minutes + " 分钟，安排今天的练习。";
    }

    /**
     * @param hasPlan        an owner plan row exists and is not EMPTY
     * @param openDue        due rows that are still NEW or have never been reviewed
     * @param totalRows      SRS rows owned by the learner
     * @param unfinishedRows rows that are still NEW or have never been reviewed, due or not
     */
    public static String emptyReason(boolean hasPlan, int openDue, int totalRows, int unfinishedRows) {
        if (!hasPlan) {
            return "NO_PLAN";
        }
        if (openDue > 0) {
            return "READY";
        }
        if (totalRows <= 0) {
            return "NO_CONTENT";
        }
        if (unfinishedRows > 0) {
            return "NO_DUE_REVIEW";
        }
        return "COMPLETED";
    }

    /**
     * First-learning guidance follows the earliest task, not account age.
     * Missing work stays visible and does not pretend the first task is done.
     */
    public static String firstLearningReason(boolean hasPlan, boolean hasTask, boolean firstTaskOpen) {
        if (!hasPlan) {
            return "NO_PLAN";
        }
        if (!hasTask) {
            return "NO_CONTENT";
        }
        return firstTaskOpen ? "INCOMPLETE" : "COMPLETED";
    }

    public static boolean firstLearningGuideVisible(String reason) {
        return !"COMPLETED".equals(reason);
    }

    /** Completed or already-started rows stay. Only an unstarted NEW row can move. */
    public static boolean preserveSrsRow(String stage, int reviewCount) {
        return reviewCount > 0 || stage == null || !"NEW".equals(stage);
    }

    private static String goalLabel(String goalCode) {
        if (goalCode == null) {
            return "当前目标";
        }
        return switch (goalCode) {
            case "zero_basis", "foundation" -> "零基础";
            case "workplace_daily" -> "职场与日常";
            case "cet_4_6", "college_cet" -> "四六级";
            case "postgraduate", "postgraduate_english" -> "考研英语";
            default -> "当前目标";
        };
    }
}
