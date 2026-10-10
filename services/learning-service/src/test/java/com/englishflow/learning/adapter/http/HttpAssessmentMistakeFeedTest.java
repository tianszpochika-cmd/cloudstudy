package com.englishflow.learning.adapter.http;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HttpAssessmentMistakeFeedTest {
    @Test
    void theFeedReadsTheAdmittedFactWithoutTheAnswer() {
        String body = """
                {"data":{"items":[{"itemId":266004,"scoreBucket":"ZERO","errorCategory":"UNCLASSIFIED",
                "contentCode":"p1.placement.v1","reasonTrace":[{"sourceAttemptId":"aatm_1","errorCategory":"UNCLASSIFIED"}],
                "answerHash":"hidden"}],"count":1}}
                """;
        List<Map<String, Object>> facts = new HttpAssessmentMistakeFeed(new ObjectMapper(), "http://127.0.0.1:18091")
                .parse(body);
        assertEquals(1, facts.size());
        assertEquals(266004, facts.getFirst().get("itemId"));
        assertEquals("ZERO", facts.getFirst().get("scoreBucket"));
        assertEquals("aatm_1", facts.getFirst().get("sourceAttemptId"));
        org.junit.jupiter.api.Assertions.assertFalse(facts.getFirst().containsKey("answerHash"));
    }
}
