package com.englishflow.learning.domain;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Learning-owned copy of an assessment ZERO mistake.
 * Assessment keeps the attempt and the mistake row. This projection is the
 * only fact the mistake queue reads. The same subject and item stay one task,
 * so a repeated source attempt does not open a second repair.
 */
public final class ZeroMistakeProjection {
    public static final String ACTION = "ASSESSMENT_ZERO";
    public static final String EVENT = "learning.mistake.admitted.v1";

    private ZeroMistakeProjection() {
    }

    public static boolean admits(String scoreBucket) {
        return "ZERO".equals(scoreBucket);
    }

    /** One repair target per subject and item. */
    public static String idempotencyKey(String subject, String itemId) {
        String raw = "assessment-zero:" + subject + ":" + itemId;
        if (raw.length() <= 192) return raw;
        return "assessment-zero:" + UUID.nameUUIDFromBytes(raw.getBytes(StandardCharsets.UTF_8));
    }

    public static String practiceDomain(String contentCode) {
        String code = contentCode == null ? "" : contentCode.toLowerCase(Locale.ROOT);
        if (hasToken(code, "reading") || hasToken(code, "rdg")) return "READING";
        return "GRAMMAR";
    }

    public static List<Map<String, Object>> rows(String subject, List<Map<String, Object>> admitted) {
        List<Map<String, Object>> rows = new ArrayList<>();
        if (subject == null || subject.isBlank() || admitted == null) return rows;
        List<String> seen = new ArrayList<>();
        for (Map<String, Object> fact : admitted) {
            if (fact == null || !admits(text(fact.get("scoreBucket")))) continue;
            String itemId = text(fact.get("itemId"));
            if (itemId.isBlank() || "0".equals(itemId)) continue;
            String key = idempotencyKey(subject, itemId);
            if (seen.contains(key)) continue;
            seen.add(key);
            String sourceAttemptId = text(fact.get("sourceAttemptId"));
            String errorCategory = text(fact.get("errorCategory"));
            if (errorCategory.isBlank()) errorCategory = "UNCLASSIFIED";
            String contentCode = text(fact.get("contentCode"));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("idempotencyKey", key);
            row.put("domainCode", practiceDomain(contentCode));
            row.put("actionCode", ACTION);
            row.put("resourceKey", itemId);
            row.put("sourceAttemptId", sourceAttemptId);
            row.put("contentCode", contentCode);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("correct", false);
            result.put("scoreBucket", "ZERO");
            result.put("mistakeStatus", "PENDING_RETRY");
            result.put("errorCategory", errorCategory);
            result.put("feedbackCode", "RULE_RETRY");
            result.put("message", "服务端规则判定为待复习");
            result.put("sourceAttemptId", sourceAttemptId);
            result.put("itemId", itemId);
            result.put("projectionVersion", EmptyBook.PROJECTION);
            row.put("result", result);
            rows.add(row);
        }
        return rows;
    }

    private static boolean hasToken(String code, String token) {
        int from = 0;
        while (from <= code.length() - token.length()) {
            int at = code.indexOf(token, from);
            if (at < 0) return false;
            boolean left = at == 0 || isBoundary(code.charAt(at - 1));
            int end = at + token.length();
            boolean right = end == code.length() || isBoundary(code.charAt(end));
            if (left && right) return true;
            from = at + 1;
        }
        return false;
    }

    private static boolean isBoundary(char value) {
        return value == '.' || value == '_' || value == ':' || value == '-';
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
