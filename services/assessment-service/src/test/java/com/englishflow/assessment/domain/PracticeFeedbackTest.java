package com.englishflow.assessment.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PracticeFeedbackTest {
    @Test
    void savedReceiptComesBeforeTheWordsAndNamesTheNextQuestion() {
        Map<String, Object> correct = PracticeFeedback.of("FULL", 1, 3).ordered();
        List<String> keys = new ArrayList<>(correct.keySet());
        assertEquals(List.of("savedReceipt", "feedbackText", "nextQuestion"), keys);
        assertTrue(keys.indexOf("savedReceipt") < keys.indexOf("feedbackText"));
        assertEquals("已保存", correct.get("savedReceipt"));
        assertEquals("正确", correct.get("feedbackText"));
        assertEquals("下一题：第 2 题", correct.get("nextQuestion"));

        Map<String, Object> again = PracticeFeedback.of("ZERO", 3, 3).ordered();
        assertEquals("需要再练", again.get("feedbackText"));
        assertEquals("本次练习已完成", again.get("nextQuestion"));
        assertEquals("需要再练", PracticeFeedback.of("PARTIAL", 2, 3).feedbackText());
    }
}
