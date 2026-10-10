package com.englishflow.assessment.domain;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GrammarReadingPackTest {
    @Test
    void placementAndCourseCodesStayOpen() {
        List<Map<String, Object>> mixed = List.of(
                rule("v", "VOCABULARY"), rule("g", "GRAMMAR"), rule("r", "READING"));
        GrammarReadingPack.Selection placement = GrammarReadingPack.select("p1.placement.v1", mixed, false);
        assertFalse(placement.closedMissing());
        assertEquals(3, placement.rules().size());

        GrammarReadingPack.Selection course = GrammarReadingPack.select("course-b25-basics",
                List.of(rule("v", "VOCABULARY")), false);
        assertFalse(course.closedMissing());
        assertEquals(1, course.rules().size());
    }

    @Test
    void grammarTakesThreeAndReadingTakesTwo() {
        GrammarReadingPack.Selection grammar = GrammarReadingPack.select("p1-b3-grammar-01", List.of(
                rule("g1", "GRAMMAR"), rule("v", "VOCABULARY"),
                rule("g2", "BASIC_GRAMMAR"), rule("g3", "GRAMMAR"), rule("g4", "GRAMMAR")), false);
        assertFalse(grammar.closedMissing());
        assertEquals(List.of("g1", "g2", "g3"), ids(grammar.rules()));

        GrammarReadingPack.Selection reading = GrammarReadingPack.select("p1.reading.v1", List.of(
                rule("r1", "READING"), rule("g", "GRAMMAR"), rule("r2", "READING")), false);
        assertFalse(reading.closedMissing());
        assertEquals(List.of("r1", "r2"), ids(reading.rules()));
    }

    @Test
    void aShortPackClosesAndANamedListStays() {
        GrammarReadingPack.Selection shortGrammar = GrammarReadingPack.select("p1-b3-grammar-01",
                List.of(rule("g1", "GRAMMAR"), rule("g2", "GRAMMAR")), false);
        assertTrue(shortGrammar.closedMissing());
        assertTrue(shortGrammar.rules().isEmpty());

        GrammarReadingPack.Selection shortReading = GrammarReadingPack.select("unit-rdg-01",
                List.of(rule("r1", "READING")), false);
        assertTrue(shortReading.closedMissing());

        GrammarReadingPack.Selection named = GrammarReadingPack.select("p1-b3-grammar-01",
                List.of(rule("g1", "GRAMMAR")), true);
        assertFalse(named.closedMissing());
        assertEquals(List.of("g1"), ids(named.rules()));
    }

    @Test
    void anExactPackIsFullOnlyWhenEveryItemIsCorrect() {
        assertEquals("FULL", GrammarReadingPack.score(3, 3));
        assertEquals("ZERO", GrammarReadingPack.score(2, 3));
        assertEquals("ZERO", GrammarReadingPack.score(0, 2));
        assertEquals("FULL", GrammarReadingPack.score(2, 2));
        assertThrows(IllegalArgumentException.class, () -> GrammarReadingPack.score(1, 0));
        assertTrue(GrammarReadingPack.isExactPack(List.of("GRAMMAR", "BASIC_GRAMMAR", "GRAMMAR")));
        assertTrue(GrammarReadingPack.isExactPack(List.of("READING", "READING")));
        assertFalse(GrammarReadingPack.isExactPack(List.of("READING", "READING", "READING")));
        assertFalse(GrammarReadingPack.isExactPack(List.of("GRAMMAR", "READING")));
    }

    private static Map<String, Object> rule(String id, String dimension) {
        return Map.of("item_id", id, "dimension", dimension);
    }

    private static List<String> ids(List<Map<String, Object>> rules) {
        List<String> ids = new ArrayList<>();
        for (Map<String, Object> rule : rules) ids.add(String.valueOf(rule.get("item_id")));
        return ids;
    }
}
