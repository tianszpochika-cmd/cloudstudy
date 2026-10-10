package com.englishflow.learning.domain;

/** A repeated completion key cannot move the stage. The untrusted code stays on the wire. */
public final class ReviewStageGuard {
    public static final String UNTRUSTED = "UNTRUSTED_REVIEW_EVIDENCE";
    public static final String ILLEGAL = "这个操作现在不能用";

    private ReviewStageGuard() {
    }

    public static String learnerCopy(String reason) {
        if (reason != null && reason.contains(UNTRUSTED)) return ILLEGAL;
        return "";
    }

    public static String stageAfter(String currentStage, String requestedStage, boolean sameCompletionKey) {
        if (sameCompletionKey || requestedStage == null || requestedStage.isBlank()) return currentStage;
        return requestedStage;
    }
}
