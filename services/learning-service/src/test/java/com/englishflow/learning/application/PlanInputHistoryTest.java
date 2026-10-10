package com.englishflow.learning.application;

import java.util.List;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlanInputHistoryTest {

    @Test
    void sameDigestReplaysAndADifferentDigestInsertsTheNextVersion() {
        List<PlanInputHistory.Existing> rows = List.of(
                new PlanInputHistory.Existing(1L, "aaa"),
                new PlanInputHistory.Existing(2L, "bbb"));

        PlanInputHistory.Decision replay = PlanInputHistory.decide(rows, "aaa");
        assertInstanceOf(PlanInputHistory.Decision.Replay.class, replay);
        assertEquals(1L, ((PlanInputHistory.Decision.Replay) replay).pinVersion());

        PlanInputHistory.Decision insert = PlanInputHistory.decide(rows, "ccc");
        assertInstanceOf(PlanInputHistory.Decision.Insert.class, insert);
        assertEquals(3L, ((PlanInputHistory.Decision.Insert) insert).pinVersion());
    }

    @Test
    void aDifferentDigestForAnExistingVersionIsRejected() {
        assertTrue(PlanInputHistory.rejectsOverwrite("stored", "incoming"));
        assertFalse(PlanInputHistory.rejectsOverwrite("same", "same"));
    }

    @Test
    void theFirstSnapshotStartsAtVersionOne() {
        PlanInputHistory.Decision insert = PlanInputHistory.decide(List.of(), "abc");
        assertInstanceOf(PlanInputHistory.Decision.Insert.class, insert);
        assertEquals(1L, ((PlanInputHistory.Decision.Insert) insert).pinVersion());
    }
}
