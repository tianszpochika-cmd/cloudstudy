package com.englishflow.assessment.domain;

import java.util.LinkedHashMap;
import java.util.Map;

/** Only a fully missed practice enters the mistake book. */
public final class MistakeAdmission {
    public static final String EVENT = "learning.mistake.admitted.v1";

    private MistakeAdmission() {
    }

    public static boolean entersBook(String totalScoreBucket) {
        return "ZERO".equals(totalScoreBucket);
    }

    /**
     * Outbox fact for the learning consumer. It names the source attempt and
     * the item. It does not carry the answer or the answer hash.
     */
    public static Map<String, Object> admittedFact(long mistakeId, long itemId, String sourceAttemptId,
            String contentCode, String errorCategory) {
        Map<String, Object> fact = new LinkedHashMap<>();
        fact.put("mistakeId", mistakeId);
        fact.put("itemId", itemId);
        fact.put("sourceAttemptId", sourceAttemptId == null ? "" : sourceAttemptId);
        fact.put("contentCode", contentCode == null ? "" : contentCode);
        fact.put("errorCategory", errorCategory == null || errorCategory.isBlank() ? "UNCLASSIFIED" : errorCategory);
        fact.put("scoreBucket", "ZERO");
        return fact;
    }

    public static String dedupeKey(String sourceAttemptId, long itemId) {
        return "mistake-admitted:" + sourceAttemptId + ":" + itemId;
    }
}
