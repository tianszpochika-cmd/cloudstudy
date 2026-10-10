package com.englishflow.assessment.domain;

import java.util.Map;

/**
 * An attempt keeps the rule version from the session that opened it.
 * The stored receipt cannot be rewritten in place.
 */
public final class AttemptGuard {
    public static final String ILLEGAL = "这个操作现在不能用";

    private AttemptGuard() {
    }

    public static String pinnedRuleVersion(String contentCode, long contentVersionId) {
        String code = contentCode == null || contentCode.isBlank() ? "content" : contentCode.trim();
        return code + ":v" + Math.max(0L, contentVersionId);
    }

    /** A caller must not supply the score, status, or attempt id. */
    public static boolean rejectsMutation(Map<String, Object> body) {
        if (body == null || body.isEmpty()) return false;
        return body.containsKey("scoreBucket")
                || body.containsKey("status")
                || body.containsKey("attemptId")
                || body.containsKey("stage");
    }
}
