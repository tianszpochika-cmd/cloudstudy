package com.englishflow.content.application;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryLexemeRepository;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.Lexeme;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * B4-04 vocabulary category mechanism: controlled pos, French morphology
 * (noun gender+number, verb conjugation class) and tag shape.
 */
@DisplayName("Lexeme morphology and controlled vocabulary (B4-04)")
class LexemeMorphologyTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-morph-001", "0123456789abcdef0123456789abcdef");
    private static final String PACK = "VOCAB-FR-PHASE1";

    private LexemeCommandService commands;
    private final AtomicInteger keys = new AtomicInteger();

    @BeforeEach
    void setUp() {
        commands = new LexemeCommandService(
                new InMemoryContentRepository(), new InMemoryLexemeRepository(),
                new InMemoryContentOutbox(), new InMemoryContentIdempotency(), CLOCK);
    }

    private ContentIdempotencyKey key() {
        return new ContentIdempotencyKey("morph-test-key-" + keys.incrementAndGet() + "-idempotency");
    }

    private static ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor"), Set.of("content:write"), false);
    }

    /** 12 French nouns with gender+number; 10 French verbs with a conjugation class. */
    static List<Map<String, Object>> frenchCatalog() {
        List<Map<String, Object>> catalog = new ArrayList<>();
        String[][] nouns = {
                {"pain", "MASCULINE", "SINGULAR", "pain (面包)"},
                {"table", "FEMININE", "SINGULAR", "table (桌子)"},
                {"livre", "MASCULINE", "SINGULAR", "livre (书)"},
                {"maison", "FEMININE", "SINGULAR", "maison (房子)"},
                {"chat", "MASCULINE", "SINGULAR", "chat (猫)"},
                {"fleur", "FEMININE", "SINGULAR", "fleur (花)"},
                {"soleil", "MASCULINE", "SINGULAR", "soleil (太阳)"},
                {"lune", "FEMININE", "SINGULAR", "lune (月亮)"},
                {"temps", "MASCULINE", "SINGULAR", "temps (时间)"},
                {"nuit", "FEMININE", "SINGULAR", "nuit (夜晚)"},
                {"fruit", "MASCULINE", "SINGULAR", "fruit (水果)"},
                {"rue", "FEMININE", "SINGULAR", "rue (街道)"},
        };
        for (String[] noun : nouns) {
            Map<String, Object> fields = new LinkedHashMap<>();
            fields.put("headword", noun[0]);
            fields.put("language", "fr-FR");
            fields.put("pos", List.of("NOUN"));
            fields.put("gender", noun[1]);
            fields.put("number", noun[2]);
            fields.put("cefr", "A1");
            fields.put("senses", List.of(Map.of("pos", "NOUN", "meaningLocal", noun[3])));
            fields.put("tags", List.of("fr:pos-noun", "fr:cefr-a1"));
            catalog.add(Map.copyOf(fields));
        }
        String[][] verbs = {
                {"parler", "FR-ER", "parler (说话)"},
                {"finir", "FR-IR", "finir (完成)"},
                {"prendre", "FR-RE", "prendre (拿)"},
                {"être", "FR-IRREGULAR", "être (是)"},
                {"avoir", "FR-IRREGULAR", "avoir (有)"},
                {"aller", "FR-IRREGULAR", "aller (去)"},
                {"faire", "FR-IRREGULAR", "faire (做)"},
                {"dire", "FR-IRREGULAR", "dire (说)"},
                {"manger", "FR-ER", "manger (吃)"},
                {"choisir", "FR-IR", "choisir (选择)"},
        };
        for (String[] verb : verbs) {
            Map<String, Object> fields = new LinkedHashMap<>();
            fields.put("headword", verb[0]);
            fields.put("language", "fr-FR");
            fields.put("pos", List.of("VERB"));
            fields.put("conjugation", Map.of("verbGroup", verb[1], "irregular", verb[1].endsWith("IRREGULAR")));
            fields.put("cefr", "A1");
            fields.put("senses", List.of(Map.of("pos", "VERB", "meaningLocal", verb[2])));
            fields.put("tags", List.of("fr:pos-verb", "fr:cefr-a1"));
            catalog.add(Map.copyOf(fields));
        }
        return List.copyOf(catalog);
    }

    @Test
    void frenchNounsAndVerbsFileCompletely() {
        List<Map<String, Object>> catalog = frenchCatalog();
        assertTrue(catalog.size() >= 20, "the B4-04 filing sample must cover at least 20 French words");
        for (Map<String, Object> fields : catalog) {
            LexemeCommandService.LexemeResult created =
                    commands.upsert(PACK, fields, null, editor(), key(), REQUEST);
            assertEquals("fr-FR", commands.current(PACK, created.lexemeId(), editor()).language());
        }
        assertEquals(catalog.size(), commands.search(PACK, null, null, null, "fr-FR", 100, null, editor()).size());
    }

    @Test
    void frenchNounWithoutGenderOrNumberIsRejected() {
        Map<String, Object> fields = new LinkedHashMap<>(frenchCatalog().get(0));
        fields.remove("gender");
        assertThrows(ContentOperationException.class,
                () -> commands.upsert(PACK, fields, null, editor(), key(), REQUEST));
        Map<String, Object> noNumber = new LinkedHashMap<>(frenchCatalog().get(1));
        noNumber.remove("number");
        assertThrows(ContentOperationException.class,
                () -> commands.upsert(PACK, noNumber, null, editor(), key(), REQUEST));
    }

    @Test
    void frenchVerbWithoutConjugationIsRejected() {
        Map<String, Object> fields = new LinkedHashMap<>(frenchCatalog().get(12));
        fields.remove("conjugation");
        assertThrows(ContentOperationException.class,
                () -> commands.upsert(PACK, fields, null, editor(), key(), REQUEST));
    }

    @Test
    void englishNounWithoutMorphologyStillAccepted() {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("headword", "habit");
        fields.put("pos", List.of("NOUN"));
        fields.put("cefr", "A2");
        fields.put("senses", List.of(Map.of("pos", "NOUN", "meaningCn", "习惯")));
        LexemeCommandService.LexemeResult created =
                commands.upsert("VOCAB-PHASE1", fields, null, editor(), key(), REQUEST);
        assertEquals("en-US", commands.current("VOCAB-PHASE1", created.lexemeId(), editor()).language());
    }

    @Test
    void convergedLongPosFormsAreAccepted() {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("headword", "le");
        fields.put("language", "fr-FR");
        fields.put("pos", List.of("ARTICLE"));
        fields.put("gender", "MASCULINE");
        fields.put("number", "SINGULAR");
        fields.put("cefr", "A1");
        fields.put("senses", List.of(Map.of("pos", "ARTICLE", "meaningLocal", "le (阳性单数定冠词)")));
        commands.upsert(PACK, fields, null, editor(), key(), REQUEST);
    }

    @Test
    void invalidVocabularyIsRejected() {
        Map<String, Object> badPos = new LinkedHashMap<>(frenchCatalog().get(0));
        badPos.put("pos", List.of("NOT_A_POS"));
        assertThrows(ContentOperationException.class,
                () -> Lexeme.validatedFields(badPos, "fr-FR"));
        Map<String, Object> badGender = new LinkedHashMap<>(frenchCatalog().get(0));
        badGender.put("gender", "COMMON");
        assertThrows(ContentOperationException.class,
                () -> Lexeme.validatedFields(badGender, "fr-FR"));
        Map<String, Object> badTag = new LinkedHashMap<>(frenchCatalog().get(0));
        badTag.put("tags", List.of(""));
        assertThrows(ContentOperationException.class,
                () -> Lexeme.validatedFields(badTag, "fr-FR"));
    }
}
