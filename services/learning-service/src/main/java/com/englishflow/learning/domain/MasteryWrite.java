package com.englishflow.learning.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Mastery is projected from evidence. A caller cannot write the stage. */
public final class MasteryWrite {
    public static final String ILLEGAL = "这个操作现在不能用";
    public static final String UNKNOWN = "WEAKNESS_UNKNOWN";
    public static final String UNKNOWN_COPY = "尚不能判断";

    private MasteryWrite() {
    }

    public static boolean rejectsDirectStage(Map<String, Object> body) {
        return body != null && body.containsKey("stage");
    }

    public static String weaknessStatus(long evidenceRows) {
        return evidenceRows > 0 ? "EVIDENCE" : UNKNOWN;
    }

    /** D+1 and D+7 for one mistake stay one target. */
    public static List<Map<String, Object>> mergeSameTarget(List<Map<String, Object>> items) {
        LinkedHashMap<String, Map<String, Object>> merged = new LinkedHashMap<>();
        List<Map<String, Object>> unkeyed = new ArrayList<>();
        for (Map<String, Object> item : items) {
            Object id = item.get("mistakeId");
            if (id == null || String.valueOf(id).isBlank()) {
                unkeyed.add(item);
                continue;
            }
            merged.putIfAbsent(String.valueOf(id), item);
        }
        List<Map<String, Object>> result = new ArrayList<>(merged.values());
        result.addAll(unkeyed);
        return result;
    }
}
