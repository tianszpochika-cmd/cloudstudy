package com.englishflow.learning.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ReviewBudgetTest {
    @Test
    void overBudgetItemsStayAndAreNotDebt() {
        List<Map<String, Object>> items = new ArrayList<>();
        for (int index = 0; index < 4; index++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("itemId", "item-" + index);
            items.add(item);
        }
        int deferred = ReviewBudget.arrange(items, 10);
        assertEquals(4, items.size());
        assertEquals(ReviewBudget.DUE, items.get(0).get("arrangement"));
        assertEquals(ReviewBudget.DUE, items.get(1).get("arrangement"));
        assertEquals(ReviewBudget.DEFERRED, items.get(2).get("arrangement"));
        assertEquals(ReviewBudget.DEFERRED_COPY, items.get(2).get("arrangementCopy"));
        assertEquals(2, deferred);
        assertFalse(items.get(3).containsKey("debt"));
        assertEquals(Sm2Scheduler.ALGORITHM_VERSION, "SM2_Q03_V1");
    }
}
