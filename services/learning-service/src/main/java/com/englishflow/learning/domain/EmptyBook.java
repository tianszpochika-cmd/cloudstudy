package com.englishflow.learning.domain;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Empty mistake books say whether practice has not started or every answer was right. */
public final class EmptyBook {
    public static final String PROJECTION = "IT4-MISTAKE-1";
    public static final String NOT_PRACTICED = "NOT_PRACTICED";
    public static final String NOT_PRACTICED_COPY = "还没有开始练习";
    public static final String ALL_CORRECT = "ALL_CORRECT";
    public static final String ALL_CORRECT_COPY = "这次练习都答对了";
    public static final String READ_FAILED = "READ_FAILED";
    public static final String READ_FAILED_COPY = "错题本暂时没有读出来";
    public static final String HAS_ITEMS = "HAS_ITEMS";

    private EmptyBook() {
    }

    public static String status(long attemptCount, long mistakeCount) {
        if (mistakeCount > 0) return HAS_ITEMS;
        if (attemptCount <= 0) return NOT_PRACTICED;
        return ALL_CORRECT;
    }

    public static String copy(String status) {
        if (READ_FAILED.equals(status)) return READ_FAILED_COPY;
        if (NOT_PRACTICED.equals(status)) return NOT_PRACTICED_COPY;
        if (ALL_CORRECT.equals(status)) return ALL_CORRECT_COPY;
        return "";
    }

    public static Map<String, Object> projection(long attemptCount, long mistakeCount) {
        String status = status(attemptCount, mistakeCount);
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("projectionVersion", PROJECTION);
        view.put("attemptCount", attemptCount);
        view.put("mistakeCount", mistakeCount);
        view.put("emptyStatus", status);
        view.put("emptyCopy", copy(status));
        return view;
    }

    /** Same subject and mistake always resume the same remediation. */
    public static long remediationId(String subject, String mistakeId) {
        String seed = subject + "|verification:" + mistakeId + "|" + mistakeId;
        return Integer.toUnsignedLong(UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8)).hashCode());
    }
}
