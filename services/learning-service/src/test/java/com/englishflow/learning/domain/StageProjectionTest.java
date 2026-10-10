package com.englishflow.learning.domain;

import java.util.List;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StageProjectionTest {
    @Test
    void anOlderEventDoesNotCoverTheStageAndUniqueAttemptsMayDifferInCount() {
        assertEquals("D7", StageProjection.accepted("D7", "D1", 1, 2));
        assertEquals("MASTERED", StageProjection.accepted("D7", "MASTERED", 3, 2));
        assertEquals(StageProjection.VERSION, "IT4-STAGE-1");
        assertTrue(AttemptReconcile.allowsDifference(List.of("attempt-1", "attempt-2"), 1, 4));
        assertFalse(AttemptReconcile.allowsDifference(List.of("attempt-1", "attempt-1"), 1, 4));
        assertTrue(AttemptReconcile.allowsDifference(List.of("attempt-1", "attempt-1"), 2, 2));
    }
}
