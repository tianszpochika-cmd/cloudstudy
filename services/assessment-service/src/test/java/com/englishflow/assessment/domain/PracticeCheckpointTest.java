package com.englishflow.assessment.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PracticeCheckpointTest {
    @Test
    void resumeStaysOnTheLastReceivedQuestionAndStopsWhenContentIsOffline() {
        PracticeCheckpoint.Resume fresh = PracticeCheckpoint.resume(0, true);
        assertEquals(1, fresh.index());
        assertEquals("上次学到第 1 题，继续", fresh.copy());
        assertFalse(fresh.stopped());

        PracticeCheckpoint.Resume saved = PracticeCheckpoint.resume(2, true);
        assertEquals(2, saved.index());
        assertEquals("上次学到第 2 题，继续", saved.copy());
        assertEquals(2, PracticeCheckpoint.clampCursor(2, 5));

        PracticeCheckpoint.Resume offline = PracticeCheckpoint.resume(2, false);
        assertTrue(offline.stopped());
        assertEquals(PracticeCheckpoint.OFFLINE_EXIT, offline.copy());
    }
}
