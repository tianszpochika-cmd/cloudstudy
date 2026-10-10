package com.englishflow.assessment.domain;

import java.util.LinkedHashMap;
import java.util.Map;

/** Learner-facing placement card. A skip is a baseline, not a measured score. */
public final class PlacementReportCard {
    public static final String SKIPPED_COPY = "这次跳过不是正式测评分数。";
    public static final String ASSESSED_COPY = "这份报告和快照是同一版本。";

    private PlacementReportCard() {
    }

    public static Map<String, Object> present(
            String resultKind, String reportId, int reportVersion, String reportDigest, Number aggregateScore) {
        boolean skipped = "SKIPPED".equals(resultKind);
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("reportId", reportId);
        card.put("reportVersion", reportVersion);
        card.put("reportDigest", reportDigest);
        card.put("officialScore", !skipped && aggregateScore != null);
        card.put("displayScore", skipped ? null : aggregateScore);
        card.put("copy", skipped ? SKIPPED_COPY : ASSESSED_COPY);
        return card;
    }
}
