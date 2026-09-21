package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.Lexeme;
import com.englishflow.content.domain.LexemeAvailability;
import com.englishflow.content.domain.LexemePronunciation;
import com.englishflow.content.port.LexemeRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Test-only lexeme double. Production uses the JDBC adapter. */
public final class InMemoryLexemeRepository implements LexemeRepository {

    private final Map<String, Lexeme> lexemes = new ConcurrentHashMap<>();
    private final Map<String, LexemePronunciation> pronunciations = new ConcurrentHashMap<>();

    @Override
    public Optional<Lexeme> findById(String lexemeId) {
        return Optional.ofNullable(lexemes.get(lexemeId));
    }

    @Override
    public Optional<Lexeme> findByPackHeadword(String packCode, String headword) {
        return lexemes.values().stream()
                .filter(lexeme -> lexeme.packCode().equals(packCode)
                        && lexeme.headword().equalsIgnoreCase(headword))
                .findFirst();
    }

    @Override
    public List<Lexeme> search(String packCode, String query, String cefr, LexemeAvailability availability,
            String language, int limit, String afterLexemeId) {
        String needle = query == null ? "" : query.trim().toLowerCase();
        String ribbon = language == null ? "" : language.trim();
        return lexemes.values().stream()
                .filter(lexeme -> lexeme.packCode().equals(packCode))
                .filter(lexeme -> needle.isEmpty() || lexeme.headword().toLowerCase().contains(needle))
                .filter(lexeme -> cefr == null || cefr.equalsIgnoreCase(lexeme.cefr()))
                .filter(lexeme -> availability == null || lexeme.availability() == availability)
                .filter(lexeme -> ribbon.isEmpty() || lexeme.language().equalsIgnoreCase(ribbon))
                .sorted(Comparator.comparing(Lexeme::headword, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(Lexeme::lexemeId))
                .filter(lexeme -> afterLexemeId == null || afterLexemeId.isBlank()
                        || lexeme.lexemeId().compareTo(afterLexemeId) > 0)
                .limit(Math.max(1, Math.min(limit, 100)))
                .toList();
    }

    @Override
    public void save(Lexeme lexeme) {
        lexemes.put(lexeme.lexemeId(), lexeme);
    }

    @Override
    public List<LexemePronunciation> listPronunciations(String lexemeId) {
        List<LexemePronunciation> result = new ArrayList<>();
        for (LexemePronunciation pronunciation : pronunciations.values()) {
            if (pronunciation.lexemeId().equals(lexemeId)) {
                result.add(pronunciation);
            }
        }
        result.sort(Comparator.comparing(LexemePronunciation::accent)
                .thenComparing(LexemePronunciation::pronunciationId));
        return List.copyOf(result);
    }

    @Override
    public void savePronunciation(LexemePronunciation pronunciation) {
        pronunciations.put(pronunciation.pronunciationId(), pronunciation);
    }
}
