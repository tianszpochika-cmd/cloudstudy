package com.englishflow.assessment.domain;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A saved answer is confirmed before the learner sees whether it was right.
 * The words are the signal. Color is not.
 */
public final class PracticeFeedback {
    public static final String SAVED = "已保存";
    public static final String CORRECT = "正确";
    public static final String AGAIN = "需要再练";

    private final String savedReceipt;
    private final String feedbackText;
    private final String nextQuestion;

    private PracticeFeedback(String savedReceipt, String feedbackText, String nextQuestion) {
        this.savedReceipt = savedReceipt;
        this.feedbackText = feedbackText;
        this.nextQuestion = nextQuestion;
    }

    public static PracticeFeedback of(String scoreBucket, int received, int total) {
        boolean correct = "FULL".equals(scoreBucket);
        int safeTotal = Math.max(1, total);
        int safeReceived = Math.max(0, Math.min(received, safeTotal));
        String next = safeReceived >= safeTotal
                ? "本次练习已完成"
                : "下一题：第 " + (safeReceived + 1) + " 题";
        return new PracticeFeedback(SAVED, correct ? CORRECT : AGAIN, next);
    }

    /** Saved receipt, then the words, then the next question. */
    public Map<String, Object> ordered() {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("savedReceipt", savedReceipt);
        fields.put("feedbackText", feedbackText);
        fields.put("nextQuestion", nextQuestion);
        return fields;
    }

    public String savedReceipt() {
        return savedReceipt;
    }

    public String feedbackText() {
        return feedbackText;
    }

    public String nextQuestion() {
        return nextQuestion;
    }
}
