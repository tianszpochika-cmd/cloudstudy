package com.englishflow.assessment.domain;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MistakeAdmissionTest {
    @Test
    void onlyAZeroPracticeEntersTheBookOncePerAttempt() {
        assertTrue(MistakeAdmission.entersBook("ZERO"));
        assertFalse(MistakeAdmission.entersBook("FULL"));
        assertFalse(MistakeAdmission.entersBook("PARTIAL"));

        AssessmentMistake mistake = new AssessmentMistake(1,
                AssessmentPrincipal.authenticated("prn_learner00000001", "platform"),
                11, 11, "UNCLASSIFIED", "grammar.pack:v1", "hash", Instant.parse("2026-10-11T00:00:00Z"));
        mistake.tagSourceAttempt("aatm_1");
        assertEquals(1, mistake.wrongCount());
        assertTrue(mistake.hasSourceAttempt("aatm_1"));
        if (!mistake.hasSourceAttempt("aatm_1")) {
            mistake.mergeWrong(Instant.parse("2026-10-11T00:01:00Z"), "UNCLASSIFIED");
        }
        assertEquals(1, mistake.wrongCount());
    }

    @Test
    void admittedFactNamesTheSourceAndLeavesTheAnswerOut() {
        var fact = MistakeAdmission.admittedFact(7, 266004, "aatm_1", "p1.placement.v1", "UNCLASSIFIED");
        assertEquals("ZERO", fact.get("scoreBucket"));
        assertEquals("aatm_1", fact.get("sourceAttemptId"));
        assertEquals(266004L, fact.get("itemId"));
        assertEquals("mistake-admitted:aatm_1:266004", MistakeAdmission.dedupeKey("aatm_1", 266004));
        assertFalse(fact.containsKey("answer"));
        assertFalse(fact.containsKey("answerHash"));
        assertEquals(MistakeAdmission.EVENT, "learning.mistake.admitted.v1");
    }
}
