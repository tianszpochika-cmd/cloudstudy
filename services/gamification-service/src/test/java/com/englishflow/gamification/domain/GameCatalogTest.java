package com.englishflow.gamification.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class GameCatalogTest {

    @Test
    void retainsSixCodesWithP0AndCumulativeP1ReleaseCounts() {
        assertEquals(6, GameCatalog.entries().size());
        assertEquals(1, GameCatalog.entries().stream()
                .filter(entry -> entry.releasePhase() == GameCatalog.ReleasePhase.P0).count());
        assertEquals(3, GameCatalog.entries().stream()
                .filter(entry -> entry.releasePhase() == GameCatalog.ReleasePhase.P1).count());
        assertEquals(4, GameCatalog.entries().stream()
                .filter(entry -> entry.releasePhase() != GameCatalog.ReleasePhase.LONG_TERM).count());
        assertEquals(2, GameCatalog.entries().stream()
                .filter(entry -> entry.releasePhase() == GameCatalog.ReleasePhase.LONG_TERM).count());
        assertTrue(GameCatalog.find("SENTENCE_TRAIN").orElseThrow().enabled());
        assertTrue(GameCatalog.entries().stream().filter(entry -> entry.releasePhase() != GameCatalog.ReleasePhase.P0)
                .noneMatch(GameCatalog.GameDefinition::enabled));
    }

    @Test
    void disabledRegistryEntryCannotCreateSession() {
        GameCatalog.GameNotAvailableException exception = assertThrows(
                GameCatalog.GameNotAvailableException.class,
                () -> GameCatalog.requireEnabled("WORD_MATCH"));
        assertEquals(GameCatalog.ReleasePhase.P1, exception.definition().releasePhase());
        assertFalse(exception.definition().enabled());
        assertThrows(GameCatalog.InvalidGameCodeException.class,
                () -> GameCatalog.requireEnabled("UNKNOWN_GAME"));
        assertThrows(GameCatalog.InvalidGameCodeException.class,
                () -> GameCatalog.requireEnabled(null));
    }
}
