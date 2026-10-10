package com.englishflow.learning.domain;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ZeroMistakeProjectionTest {
    @Test
    void onlyZeroFactsProjectAndTheSameItemStaysOneTask() {
        List<Map<String, Object>> rows = ZeroMistakeProjection.rows("prn_learner", List.of(
                Map.of("scoreBucket", "FULL", "itemId", "1", "sourceAttemptId", "aatm_full"),
                Map.of("scoreBucket", "ZERO", "itemId", "266004", "sourceAttemptId", "aatm_1",
                        "contentCode", "p1.placement.v1", "errorCategory", "UNCLASSIFIED"),
                Map.of("scoreBucket", "ZERO", "itemId", "266004", "sourceAttemptId", "aatm_1",
                        "contentCode", "p1.placement.v1", "errorCategory", "UNCLASSIFIED"),
                Map.of("scoreBucket", "PARTIAL", "itemId", "9", "sourceAttemptId", "aatm_partial")));
        assertEquals(1, rows.size());
        Map<String, Object> row = rows.getFirst();
        assertEquals("ASSESSMENT_ZERO", row.get("actionCode"));
        assertEquals("GRAMMAR", row.get("domainCode"));
        assertEquals("assessment-zero:prn_learner:266004", row.get("idempotencyKey"));
        assertEquals("aatm_1", row.get("sourceAttemptId"));
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) row.get("result");
        assertEquals(false, result.get("correct"));
        assertEquals("ZERO", result.get("scoreBucket"));
        assertFalse(result.containsKey("answer"));
        assertFalse(result.containsKey("answerHash"));
        assertTrue(ZeroMistakeProjection.admits("ZERO"));
        assertFalse(ZeroMistakeProjection.admits("FULL"));
    }

    @Test
    void aReadingCodeKeepsItsOwnDomain() {
        List<Map<String, Object>> rows = ZeroMistakeProjection.rows("prn_learner", List.of(
                Map.of("scoreBucket", "ZERO", "itemId", "42", "sourceAttemptId", "aatm_read",
                        "contentCode", "p1.reading.v1")));
        assertEquals("READING", rows.getFirst().get("domainCode"));
    }
}
