package com.englishflow.gamification.domain;

import java.util.List;
import java.util.Optional;

/**
 * Server-owned B4 game registry and release gate.
 *
 * <p>The enum is a long-lived compatibility registry.  Availability is a
 * separate server fact so that retaining an enum value never implicitly
 * enables a game.</p>
 */
public final class GameCatalog {

    public enum ReleasePhase {
        P0,
        P1,
        LONG_TERM
    }

    public record GameDefinition(
            String gameCode,
            ReleasePhase releasePhase,
            boolean enabled,
            int maxMinutes,
            int pauseLimitMinutes,
            int passAccuracyPercent,
            int passCompletionPercent) {
    }

    private static final List<GameDefinition> ENTRIES = List.of(
            new GameDefinition("SENTENCE_TRAIN", ReleasePhase.P0, true, 10, 2, 60, 60),
            new GameDefinition("WORD_MATCH", ReleasePhase.P1, false, 10, 2, 60, 60),
            new GameDefinition("WORD_DEFENSE", ReleasePhase.P1, false, 10, 2, 60, 60),
            new GameDefinition("WORD_PUZZLE", ReleasePhase.P1, false, 10, 2, 60, 60),
            new GameDefinition("GRAMMAR_BLASTER", ReleasePhase.LONG_TERM, false, 10, 2, 60, 60),
            new GameDefinition("CATCH_MEANING", ReleasePhase.LONG_TERM, false, 10, 2, 60, 60));

    private GameCatalog() {
    }

    public static List<GameDefinition> entries() {
        return ENTRIES;
    }

    public static Optional<GameDefinition> find(String gameCode) {
        return ENTRIES.stream().filter(entry -> entry.gameCode().equals(gameCode)).findFirst();
    }

    public static GameDefinition requireEnabled(String gameCode) {
        GameDefinition definition = find(gameCode).orElseThrow(InvalidGameCodeException::new);
        if (!definition.enabled()) {
            throw new GameNotAvailableException(definition);
        }
        return definition;
    }

    public static final class InvalidGameCodeException extends RuntimeException {
        public InvalidGameCodeException() {
            super("gameCode is missing or not in the B4 registry");
        }
    }

    public static final class GameNotAvailableException extends RuntimeException {
        private final GameDefinition definition;

        public GameNotAvailableException(GameDefinition definition) {
            super("game is not enabled for its release phase");
            this.definition = definition;
        }

        public GameDefinition definition() {
            return definition;
        }
    }
}
