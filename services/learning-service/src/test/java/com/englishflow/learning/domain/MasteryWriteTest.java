package com.englishflow.learning.domain;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MasteryWriteTest {
    @Test
    void directStageIsRejectedAndTheSameTargetCollapses() {
        assertTrue(MasteryWrite.rejectsDirectStage(Map.of("stage", "MASTERED")));
        assertFalse(MasteryWrite.rejectsDirectStage(Map.of("mistakeId", "m-1")));
        assertEquals(MasteryWrite.UNKNOWN, MasteryWrite.weaknessStatus(0));
        assertEquals("EVIDENCE", MasteryWrite.weaknessStatus(2));
        List<Map<String, Object>> merged = MasteryWrite.mergeSameTarget(List.of(
                Map.of("mistakeId", "m-1", "stage", "D1"),
                Map.of("mistakeId", "m-1", "stage", "D7")));
        assertEquals(1, merged.size());
        assertEquals("D1", merged.get(0).get("stage"));
        assertEquals(MasteryWrite.UNKNOWN_COPY, "尚不能判断");
    }
}
