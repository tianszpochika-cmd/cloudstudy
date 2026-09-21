package com.englishflow.content.port;

import com.englishflow.content.domain.Lexeme;
import com.englishflow.content.domain.LexemeAvailability;
import com.englishflow.content.domain.LexemePronunciation;

import java.util.List;
import java.util.Optional;

/** Lexeme-master repository port owned by content-service; no cross-service SQL is allowed. */
public interface LexemeRepository {

    Optional<Lexeme> findById(String lexemeId);

    Optional<Lexeme> findByPackHeadword(String packCode, String headword);

    /**
     * Cursor-style search. {@code afterLexemeId} is the last seen id (lexicographic,
     * headword-ordered page); empty means first page.
     */
    List<Lexeme> search(String packCode, String query, String cefr, LexemeAvailability availability,
            int limit, String afterLexemeId);

    void save(Lexeme lexeme);

    List<LexemePronunciation> listPronunciations(String lexemeId);

    void savePronunciation(LexemePronunciation pronunciation);
}
