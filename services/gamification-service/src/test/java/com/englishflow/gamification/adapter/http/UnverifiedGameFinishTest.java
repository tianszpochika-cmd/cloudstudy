package com.englishflow.gamification.adapter.http;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class UnverifiedGameFinishTest {

    @Test
    void legacyClientEventsCannotProducePassOrRewardWithoutVerifiedJudgement() {
        Map<String, Object> session = new HashMap<>();
        session.put("attemptCount", 5);
        session.put("accuracyPercent", 100);
        session.put("serverScore", 50);
        session.put("passed", true);
        session.put("rewardEligible", true);

        GamificationLocalFeatureController.markUnverifiedGameFinish(session);

        assertEquals("COMPLETED", session.get("status"));
        assertEquals(0, session.get("accuracyPercent"));
        assertEquals(0, session.get("completionPercent"));
        assertEquals(0, session.get("serverScore"));
        assertFalse((boolean) session.get("passed"));
        assertFalse((boolean) session.get("rewardEligible"));
    }
}
