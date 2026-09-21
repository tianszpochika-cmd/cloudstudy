package com.englishflow.content.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryLexemeRepository;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.Lexeme;

/**
 * Cursor pagination must return every row exactly once. Rows are ordered by
 * (headword, lexeme_id) while ids are opaque, so the cursor has to resume from
 * the anchor row's position instead of comparing bare ids.
 */
@DisplayName("Lexeme keyset pagination returns every row exactly once")
class LexemeCursorPaginationTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-page-001", "0123456789abcdef0123456789abcdef");
    private static final String PACK = "VOCAB-PHASE1";

    private InMemoryLexemeRepository rows;
    private LexemeCommandService commands;
    private final AtomicInteger keys = new AtomicInteger();

    @BeforeEach
    void setUp() {
        rows = new InMemoryLexemeRepository();
        commands = new LexemeCommandService(
                new InMemoryContentRepository(), rows,
                new com.englishflow.content.adapter.memory.InMemoryContentOutbox(),
                new InMemoryContentIdempotency(), CLOCK);
    }

    private ContentIdempotencyKey key() {
        return new ContentIdempotencyKey("page-test-key-" + keys.incrementAndGet() + "-idempotency");
    }

    private static ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor"), Set.of("content:write"), false);
    }

    private static Map<String, Object> fields(String headword) {
        return Map.of(
                "headword", headword,
                "lemma", headword,
                "pos", List.of("NOUN"),
                "senses", List.of(Map.of("pos", "NOUN", "meaningCn", "含义")));
    }

    @Test
    void walkingWithLimitTwoCoversFiveRowsExactlyOnce() {
        // Ids deliberately run opposite to headword order: a bare "id > cursor"
        // predicate would revisit the first page and drop the tail.
        String[] headwords = {"w-alpha", "w-bravo", "w-charlie", "w-delta", "w-echo"};
        for (int index = 0; index < headwords.length; index++) {
            commands.upsert(PACK, fields(headwords[index]), "lx_page_" + (9 - index), editor(), key(), REQUEST);
        }

        List<String> seen = new ArrayList<>();
        String cursor = null;
        for (int page = 0; page < 5; page++) {
            List<Lexeme> batch = rows.search(PACK, null, null, null, null, 2, cursor);
            if (batch.isEmpty()) {
                break;
            }
            for (Lexeme row : batch) {
                seen.add(row.headword());
            }
            cursor = batch.get(batch.size() - 1).lexemeId();
        }

        assertEquals(List.of(headwords), seen, "every row must appear exactly once in headword order");
        assertEquals(new LinkedHashSet<>(seen).size(), seen.size(), "no row may repeat across pages");
    }

    @Test
    void unknownCursorRestartsFromFirstPage() {
        commands.upsert(PACK, fields("w-alpha"), "lx_page_a", editor(), key(), REQUEST);
        List<Lexeme> batch = rows.search(PACK, null, null, null, null, 10, "lx_missing");
        assertEquals(1, batch.size());
        assertEquals("w-alpha", batch.get(0).headword());
    }

    @Test
    void wildcardQueryIsLiteral() {
        commands.upsert(PACK, fields("w-alpha"), "lx_page_w", editor(), key(), REQUEST);
        List<Lexeme> batch = rows.search(PACK, "%", null, null, null, 10, null);
        assertTrue(batch.isEmpty(), "a literal % must not match every headword");
    }
}
