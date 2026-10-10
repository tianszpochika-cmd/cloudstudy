package com.englishflow.learning.application;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlanDayFactsTest {

    @Test
    void explanationUsesTheGoalMinutesAndResultKindOnly() {
        assertEquals("根据目标「零基础」和每日 15 分钟，安排今天的练习。",
                PlanDayFacts.explanation("zero_basis", 15, "ASSESSED"));
        assertEquals("根据目标「职场与日常」和每日 30 分钟，安排今天的练习。",
                PlanDayFacts.explanation("workplace_daily", 30, "ASSESSED"));
        assertEquals("初始安排，后续按练习调整",
                PlanDayFacts.explanation("zero_basis", 15, "SKIPPED"));
        assertEquals("根据目标「当前目标」和每日 5 分钟，安排今天的练习。",
                PlanDayFacts.explanation("not-a-catalog-code", 5, "ASSESSED"));
    }

    @Test
    void emptyReasonSplitsTheFiveQueueStates() {
        assertEquals("NO_PLAN", PlanDayFacts.emptyReason(false, 0, 0, 0));
        assertEquals("READY", PlanDayFacts.emptyReason(true, 2, 2, 2));
        assertEquals("NO_CONTENT", PlanDayFacts.emptyReason(true, 0, 0, 0));
        assertEquals("NO_DUE_REVIEW", PlanDayFacts.emptyReason(true, 0, 3, 1));
        assertEquals("COMPLETED", PlanDayFacts.emptyReason(true, 0, 3, 0));
    }

    @Test
    void firstLearningFollowsCompletionRatherThanAccountAge() {
        assertEquals("NO_PLAN", PlanDayFacts.firstLearningReason(false, false, false));
        assertEquals("NO_CONTENT", PlanDayFacts.firstLearningReason(true, false, false));
        assertEquals("INCOMPLETE", PlanDayFacts.firstLearningReason(true, true, true));
        assertEquals("COMPLETED", PlanDayFacts.firstLearningReason(true, true, false));
        assertTrue(PlanDayFacts.firstLearningGuideVisible("INCOMPLETE"));
        assertTrue(PlanDayFacts.firstLearningGuideVisible("NO_PLAN"));
        assertFalse(PlanDayFacts.firstLearningGuideVisible("COMPLETED"));
    }

    @Test
    void completedRowsArePreservedAndUnstartedNewRowsCanMove() {
        assertTrue(PlanDayFacts.preserveSrsRow("REVIEW", 2));
        assertTrue(PlanDayFacts.preserveSrsRow("NEW", 1));
        assertTrue(PlanDayFacts.preserveSrsRow("LEARNING", 0));
        assertFalse(PlanDayFacts.preserveSrsRow("NEW", 0));
    }
}
