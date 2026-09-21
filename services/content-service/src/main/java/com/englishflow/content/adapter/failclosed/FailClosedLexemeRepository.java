package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.Lexeme;
import com.englishflow.content.domain.LexemeAvailability;
import com.englishflow.content.domain.LexemePronunciation;
import com.englishflow.content.port.LexemeRepository;

import java.util.List;
import java.util.Optional;

/** Fail-closed lexeme port used when JDBC persistence is disabled. */
public final class FailClosedLexemeRepository implements LexemeRepository {

    private static ContentOperationException unavailable() {
        return ContentOperationException.unavailable("LEXEME_PERSISTENCE_DISABLED",
                "lexeme persistence is disabled; refusing to invent word-master facts");
    }

    @Override
    public Optional<Lexeme> findById(String lexemeId) {
        throw unavailable();
    }

    @Override
    public Optional<Lexeme> findByPackHeadword(String packCode, String headword) {
        throw unavailable();
    }

    @Override
    public List<Lexeme> search(String packCode, String query, String cefr, LexemeAvailability availability,
            int limit, String afterLexemeId) {
        throw unavailable();
    }

    @Override
    public void save(Lexeme lexeme) {
        throw unavailable();
    }

    @Override
    public List<LexemePronunciation> listPronunciations(String lexemeId) {
        throw unavailable();
    }

    @Override
    public void savePronunciation(LexemePronunciation pronunciation) {
        throw unavailable();
    }
}
