package com.englishflow.learning.domain;

import java.util.ArrayList;
import java.util.List;

/** Clients read one stage. An older event must not cover a newer projection. */
public final class StageProjection {
    public static final String VERSION = "IT4-STAGE-1";

    private StageProjection() {
    }

    public static boolean stale(long eventVersion, long currentVersion) {
        return eventVersion < currentVersion;
    }

    public static String accepted(String current, String incoming, long eventVersion, long currentVersion) {
        if (incoming == null || incoming.isBlank() || stale(eventVersion, currentVersion)) return current;
        return incoming;
    }
}

/** Different mistake and attempt counts are allowed when each source attempt id appears once. */
final class AttemptReconcile {
    private AttemptReconcile() {
    }

    static boolean allowsDifference(List<String> sourceAttemptIds, int mistakeRows, int attemptRows) {
        List<String> ids = new ArrayList<>();
        if (sourceAttemptIds != null) {
            for (String id : sourceAttemptIds) {
                if (id != null && !id.isBlank()) ids.add(id);
            }
        }
        long unique = ids.stream().distinct().count();
        if (unique == ids.size()) return true;
        return mistakeRows == attemptRows;
    }
}
