package com.englishflow.assessment.domain;

import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class PlacementReportCardTest {

    @Test
    void skippedBaselineIsNotAFormalScoreAndKeepsTheSnapshotIdentity() {
        Map<String, Object> skipped = PlacementReportCard.present("SKIPPED", "rpt_skip", 1, "digest-skip", 80);
        assertEquals(false, skipped.get("officialScore"));
        assertNull(skipped.get("displayScore"));
        assertEquals(PlacementReportCard.SKIPPED_COPY, skipped.get("copy"));
        assertEquals("rpt_skip", skipped.get("reportId"));
        assertEquals(1, skipped.get("reportVersion"));
        assertEquals("digest-skip", skipped.get("reportDigest"));

        Map<String, Object> assessed = PlacementReportCard.present("ASSESSED", "rpt_ok", 1, "digest-ok", 80);
        assertEquals(true, assessed.get("officialScore"));
        assertEquals(80, assessed.get("displayScore"));
        assertEquals(PlacementReportCard.ASSESSED_COPY, assessed.get("copy"));
        assertEquals(skipped.get("reportVersion"), assessed.get("reportVersion"));
    }
}
