package com.englishflow.assessment.domain;

import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AttemptGuardTest {
    @Test
    void oldSessionKeepsItsOpenRuleVersionAndRejectsARewrite() {
        assertEquals("grammar.pack:v3", AttemptGuard.pinnedRuleVersion("grammar.pack", 3));
        assertEquals("grammar.pack:v3", AttemptGuard.pinnedRuleVersion("grammar.pack", 3));
        assertFalse(AttemptGuard.rejectsMutation(Map.of("submissionId", "sub-1", "items", java.util.List.of())));
        assertTrue(AttemptGuard.rejectsMutation(Map.of("scoreBucket", "FULL")));
        assertTrue(AttemptGuard.rejectsMutation(Map.of("status", "ASSESSED")));
        assertEquals(AttemptGuard.ILLEGAL, "这个操作现在不能用");
    }
}
