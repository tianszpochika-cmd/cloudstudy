package com.englishflow.assessment.web;

import com.englishflow.assessment.port.PlacementRuleScorePort;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Bank practice grades through the service-token score port. The option stays in content. */
class B10PlacementScoreGradeTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void bankRowGradesThroughTheScorePort() {
        PlacementRuleScorePort scores = (itemId, optionId) -> {
            assertEquals(266004L, itemId);
            boolean full = "b".equals(optionId);
            return new PlacementRuleScorePort.RuleScore(full ? "FULL" : "ZERO",
                    full ? PlacementRuleScorePort.FULL_EXPLANATION : PlacementRuleScorePort.ZERO_EXPLANATION);
        };
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(
                new JdbcTemplate(), mapper, "http://127.0.0.1:9", scores);
        Map<String, Object> rule = Map.of("item_id", "266004",
                "answer_rule_json", "{\"grader\":\"PLACEMENT_SCORE\"}");
        assertFalse(controller.gradeRule(rule, "a"));
        assertTrue(controller.gradeRule(rule, "b"));
        assertFalse(controller.gradeRule(rule, " "));
    }

    @Test
    void missingScorePortFailsClosed() {
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(
                new JdbcTemplate(), mapper, "http://127.0.0.1:9");
        Map<String, Object> rule = Map.of("item_id", "266004",
                "answer_rule_json", "{\"grader\":\"PLACEMENT_SCORE\"}");
        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.gradeRule(rule, "a"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, missing.getStatusCode());
    }

    @Test
    void localAnswerRuleStillGradesWithoutTheScorePort() {
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(
                new JdbcTemplate(), mapper, "http://127.0.0.1:9");
        Map<String, Object> rule = Map.of("item_id", "local-1", "answer_rule_json", "{\"answer\":\"b\"}");
        assertTrue(controller.gradeRule(rule, "b"));
        assertFalse(controller.gradeRule(rule, "a"));
    }
}
