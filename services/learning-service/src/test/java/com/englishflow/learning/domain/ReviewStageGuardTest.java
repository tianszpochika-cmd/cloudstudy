package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReviewStageGuardTest {
    @Test
    void theSameCompletionKeyDoesNotAdvanceAndTheCodeStaysOffTheScreen() {
        assertEquals("D1", ReviewStageGuard.stageAfter("D1", "D7", true));
        assertEquals("D7", ReviewStageGuard.stageAfter("D1", "D7", false));
        assertEquals(ReviewStageGuard.ILLEGAL, ReviewStageGuard.learnerCopy("UNTRUSTED_REVIEW_EVIDENCE"));
        assertEquals("", ReviewStageGuard.learnerCopy("复习状态发生变化，请刷新后恢复。"));
    }
}
