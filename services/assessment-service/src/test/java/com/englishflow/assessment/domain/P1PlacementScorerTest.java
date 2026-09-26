package com.englishflow.assessment.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class P1PlacementScorerTest {
    private static List<P1PlacementScorer.Item> manifest() {
        List<P1PlacementScorer.Item> items = new ArrayList<>();
        for (int i = 1; i <= 3; i++) items.add(new P1PlacementScorer.Item("v" + i, P1PlacementScorer.Dimension.VOCABULARY));
        for (int i = 1; i <= 3; i++) items.add(new P1PlacementScorer.Item("g" + i, P1PlacementScorer.Dimension.BASIC_GRAMMAR));
        for (int i = 1; i <= 2; i++) items.add(new P1PlacementScorer.Item("r" + i, P1PlacementScorer.Dimension.READING));
        for (int i = 1; i <= 2; i++) items.add(new P1PlacementScorer.Item("l" + i, P1PlacementScorer.Dimension.LISTENING));
        return items;
    }

    @Test
    void requiresTheClosedTenItemFourDimensionManifest() {
        List<P1PlacementScorer.Item> items = manifest();
        P1PlacementScorer.requireManifest(items);
        assertThrows(IllegalArgumentException.class, () -> P1PlacementScorer.requireManifest(items.subList(0, 9)));
        List<P1PlacementScorer.Item> duplicate = new ArrayList<>(items);
        duplicate.set(9, duplicate.get(8));
        assertThrows(IllegalArgumentException.class, () -> P1PlacementScorer.requireManifest(duplicate));
    }

    @Test
    void separatesCoverageFromCorrectnessAndNeverCompletesAnIncompleteSet() {
        List<P1PlacementScorer.Item> items = manifest();
        Map<String, Boolean> answers = new LinkedHashMap<>();
        assertEquals("UNVERIFIED", P1PlacementScorer.progress(items, answers).confidence());
        for (int i = 0; i < 8; i++) answers.put(items.get(i).itemId(), false);
        assertEquals("LOW", P1PlacementScorer.progress(items, answers).confidence());
        answers.remove("r2");
        answers.put("l1", false);
        assertEquals("MEDIUM", P1PlacementScorer.progress(items, answers).confidence());
        assertEquals(new BigDecimal("0.80"), P1PlacementScorer.progress(items, answers).coverageRatio());
        assertThrows(IllegalArgumentException.class, () -> P1PlacementScorer.assess(items, answers));
    }

    @Test
    void scoresFourDimensionsWithHalfUpRoundingAndPinnedLevelBoundaries() {
        List<P1PlacementScorer.Item> items = manifest();
        Map<String, Boolean> answers = new LinkedHashMap<>();
        for (P1PlacementScorer.Item item : items) answers.put(item.itemId(), false);
        answers.put("v1", true);
        answers.put("g1", true);
        answers.put("g2", true);
        answers.put("r1", true);
        answers.put("l1", true);
        P1PlacementScorer.Assessed assessed = P1PlacementScorer.assess(items, answers);
        assertEquals(new BigDecimal("33.33"), assessed.dimensionSummaries().get(0).dimensionPercent());
        assertEquals(50, assessed.aggregateScore());
        assertEquals("A2", assessed.referenceLevel());
        assertEquals("HIGH", assessed.progress().confidence());
        assertEquals(List.of("A1", "A2", "B1", "B2", "C1", "C2"),
                List.of(39, 40, 60, 75, 85, 93).stream().map(P1PlacementScorer::referenceLevel).toList());
    }

    @Test
    void rejectsUnknownAnswersAndClientLikeNullCorrectness() {
        List<P1PlacementScorer.Item> items = manifest();
        assertThrows(IllegalArgumentException.class,
                () -> P1PlacementScorer.progress(items, Map.of("not-pinned", true)));
        Map<String, Boolean> answers = new LinkedHashMap<>();
        answers.put("v1", null);
        assertThrows(IllegalArgumentException.class, () -> P1PlacementScorer.progress(items, answers));
    }
}
