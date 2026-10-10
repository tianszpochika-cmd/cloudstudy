package com.englishflow.assessment.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class PracticeCompletionTest {
    @Test
    void oneSessionHasOneCompletionKeyAndNoReward() {
        assertEquals("practice-complete:asess_1", PracticeCompletion.dedupeKey("asess_1"));
        assertEquals(PracticeCompletion.dedupeKey("asess_1"), PracticeCompletion.dedupeKey("asess_1"));
        assertFalse(PracticeCompletion.rewardVisible());
    }
}
