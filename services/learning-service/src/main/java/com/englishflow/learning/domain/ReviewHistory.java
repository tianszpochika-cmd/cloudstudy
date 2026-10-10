package com.englishflow.learning.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** History shows finished and postponed reviews. An empty queue says which kind of empty it is. */
public final class ReviewHistory {
    public static final String COMPLETED = "COMPLETED";
    public static final String DEFERRED = "DEFERRED";
    public static final String NO_DUE = "NO_DUE";
    public static final String NO_DUE_COPY = "暂无到期复习";
    public static final String NO_RECORD = "NO_RECORD";
    public static final String NO_RECORD_COPY = "还没有复习记录";
    public static final String READ_FAILED = "READ_FAILED";
    public static final String READ_FAILED_COPY = "复习列表暂时没有读出来";
    public static final String READY = "READY";

    private ReviewHistory() {
    }

    public static boolean visible(String disposition) {
        return COMPLETED.equals(disposition) || DEFERRED.equals(disposition);
    }

    public static List<Map<String, Object>> onlyVisible(List<Map<String, Object>> rows) {
        List<Map<String, Object>> kept = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            if (visible(String.valueOf(row.get("disposition")))) kept.add(row);
        }
        return kept;
    }

    public static String emptyStatus(boolean queueEmpty, boolean hasAnyRecord) {
        if (!queueEmpty) return READY;
        return hasAnyRecord ? NO_DUE : NO_RECORD;
    }

    public static String copy(String status) {
        if (NO_DUE.equals(status)) return NO_DUE_COPY;
        if (NO_RECORD.equals(status)) return NO_RECORD_COPY;
        if (READ_FAILED.equals(status)) return READ_FAILED_COPY;
        return "";
    }
}
