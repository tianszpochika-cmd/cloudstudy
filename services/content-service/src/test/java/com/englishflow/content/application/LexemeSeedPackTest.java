package com.englishflow.content.application;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryLexemeRepository;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.LexemeAvailability;
import com.englishflow.content.domain.LexemePronunciation;
import com.englishflow.content.domain.ReviewDecision;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
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
 * B4-07 seed packs: the French VOCAB-FR-PHASE1 seed (50 words, full chain each)
 * and the German VOCAB-DE-PHASE1 pipeline (5 words end to end).
 *
 * <p>Each JSONL line mirrors one {@code import/batch} lexeme entry
 * ({@code contentCode + lexeme + lexemeId}); the test replays the same service
 * calls the batch endpoint performs, through the full
 * draft/submit/first/final/publish chain. Pronunciation rows carry placeholder
 * media-service asset ids (audio bytes never flow through content-service).</p>
 */
@DisplayName("Seed packs: French 50-word pack and German 5-word pipeline (B4-07)")
class LexemeSeedPackTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-seed-001", "0123456789abcdef0123456789abcdef");
    private static final String FR_PACK = "VOCAB-FR-PHASE1";
    private static final String DE_PACK = "VOCAB-DE-PHASE1";

    private InMemoryContentRepository contents;
    private InMemoryLexemeRepository lexemes;
    private InMemoryContentOutbox outbox;
    private LexemeCommandService commands;
    private final AtomicInteger keys = new AtomicInteger();

    @BeforeEach
    void setUp() {
        contents = new InMemoryContentRepository();
        lexemes = new InMemoryLexemeRepository();
        outbox = new InMemoryContentOutbox();
        commands = new LexemeCommandService(
                contents, lexemes, outbox, new InMemoryContentIdempotency(), CLOCK);
    }

    private ContentIdempotencyKey key() {
        return new ContentIdempotencyKey("seed-test-key-" + keys.incrementAndGet() + "-idempotency");
    }

    private static ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor"), Set.of("content:write"), false);
    }

    private static ContentActor reviewerL1() {
        return new ContentActor("reviewer-1", "platform", Set.of("review-l1"), Set.of("content:review:first"), false);
    }

    private static ContentActor reviewerL2() {
        return new ContentActor("reviewer-2", "platform", Set.of("review-l2"), Set.of("content:review:final"), false);
    }

    private static ContentActor publisher() {
        return new ContentActor("publisher-1", "platform", Set.of("content-publisher"), Set.of("content:publish"), false);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> seed(String resource) throws Exception {
        tools.jackson.databind.ObjectMapper mapper = new tools.jackson.databind.ObjectMapper();
        List<Map<String, Object>> entries = new ArrayList<>();
        try (InputStream stream = LexemeSeedPackTest.class.getResourceAsStream(resource);
             BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                Object value = mapper.readValue(line, Map.class);
                entries.add((Map<String, Object>) value);
            }
        }
        return List.copyOf(entries);
    }

    private static Map<String, Object> fieldsOf(Map<String, Object> entry) {
        Object fields = entry.get("lexeme");
        if (!(fields instanceof Map<?, ?> map)) {
            throw new IllegalStateException("seed entry has no lexeme object");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> field : map.entrySet()) {
            result.put(String.valueOf(field.getKey()), field.getValue());
        }
        return result;
    }

    private static String text(Map<String, Object> entry, String key) {
        return String.valueOf(entry.get(key));
    }

    private static String fieldText(Map<String, Object> fields, String... keys) {
        for (String key : keys) {
            Object value = fields.get(key);
            if (value instanceof String text && !text.isBlank()) {
                return text;
            }
        }
        return "";
    }

    /** Full chain for one seed entry: upsert, dual review, publish, pronunciation + QC. */
    private void publishSeedEntry(String pack, Map<String, Object> entry, String accent) {
        Map<String, Object> fields = fieldsOf(entry);
        String lexemeId = text(entry, "lexemeId");
        LexemeCommandService.LexemeResult created =
                commands.upsert(pack, fields, lexemeId, editor(), key(), REQUEST);
        assertEquals(lexemeId, created.lexemeId());
        commands.submit(pack, lexemeId, editor(), key(), REQUEST);
        commands.reviewFirst(pack, lexemeId, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
        commands.reviewFinal(pack, lexemeId, ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
        LexemeCommandService.LexemeResult published =
                commands.publish(pack, lexemeId, "SEED_PACK_RELEASE", publisher(), key(), REQUEST);
        assertEquals(LexemeAvailability.PUBLISHED, published.availability());
        String ipa = fieldText(fields, "phoneticFr", "phoneticDe");
        String assetId = fieldText(fields, "audioFrAssetId", "audioDeAssetId");
        assertTrue(!ipa.isBlank() && !assetId.isBlank(), "seed entries carry phonetics and audio placeholders");
        LexemePronunciation pronunciation = commands.upsertPronunciation(pack, lexemeId,
                Map.of("accent", accent, "ipa", ipa, "audioAssetId", assetId, "sourceType", "TTS"),
                editor(), key(), REQUEST);
        LexemePronunciation cleaned = commands.reviewPronunciation(pack, lexemeId,
                Map.of("pronunciationId", pronunciation.pronunciationId(), "qcStatus", "CLEAN"),
                "SEED_PRON_QC", editor(), key(), REQUEST);
        assertEquals("CLEAN", cleaned.qcStatus());
    }

    @Test
    void frenchPackPublishesFiftyWords() throws Exception {
        List<Map<String, Object>> entries = seed("/seed/vocab-fr-phase1.jsonl");
        assertTrue(entries.size() >= 50, "the French seed pack must carry at least 50 words");
        for (Map<String, Object> entry : entries) {
            publishSeedEntry(FR_PACK, entry, "FR-PARIS");
        }

        LexemeAvailability anyStatus = null;
        assertEquals(entries.size(),
                lexemes.search(FR_PACK, null, null, anyStatus, "fr-FR", 100, null).size());
        assertEquals(entries.size(),
                lexemes.search(FR_PACK, null, null, LexemeAvailability.PUBLISHED, "fr-FR", 100, null).size());
        long publishedFacts = outbox.events().stream()
                .filter(event -> "content.lexeme.published.v1".equals(event.eventType())).count();
        assertEquals(entries.size(), publishedFacts);

        ContentDefinition pack = contents.findByCode(FR_PACK).orElseThrow();
        assertEquals(ContentKind.VOCABULARY, pack.kind());
        assertEquals("fr-FR", pack.locale());
    }

    @Test
    void germanPipelinePublishesFiveWordsEndToEnd() throws Exception {
        List<Map<String, Object>> entries = seed("/seed/vocab-de-phase1.jsonl");
        assertEquals(5, entries.size());
        for (int index = 0; index < entries.size(); index++) {
            Map<String, Object> entry = entries.get(index);
            Map<String, Object> fields = fieldsOf(entry);
            String lexemeId = text(entry, "lexemeId");
            commands.upsert(DE_PACK, fields, lexemeId, editor(), key(), REQUEST);
            commands.submit(DE_PACK, lexemeId, editor(), key(), REQUEST);
            commands.reviewFirst(DE_PACK, lexemeId, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
            if (index == entries.size() - 1) {
                // Negative: the first reviewer cannot approve their own final review.
                ContentActor sameAsFirst = new ContentActor("reviewer-1", "platform",
                        Set.of("review-l1", "review-l2"),
                        Set.of("content:review:first", "content:review:final"), false);
                assertThrows(ContentOperationException.class, () -> commands.reviewFinal(
                        DE_PACK, lexemeId, ReviewDecision.APPROVED, sameAsFirst, key(), REQUEST));
            }
            commands.reviewFinal(DE_PACK, lexemeId, ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
            LexemeCommandService.LexemeResult published =
                    commands.publish(DE_PACK, lexemeId, "SEED_PACK_RELEASE", publisher(), key(), REQUEST);
            assertEquals(LexemeAvailability.PUBLISHED, published.availability());
            publishSeedEntryPronunciationOnly(DE_PACK, entry, lexemeId, fields);
        }

        LexemeAvailability anyStatus = null;
        assertEquals(5, lexemes.search(DE_PACK, null, null, LexemeAvailability.PUBLISHED, "de-DE", 100, null).size());
        assertEquals(0, lexemes.search(DE_PACK, null, null, anyStatus, "fr-FR", 100, null).size());
        ContentDefinition pack = contents.findByCode(DE_PACK).orElseThrow();
        assertEquals(ContentKind.VOCABULARY, pack.kind());
        assertEquals("de-DE", pack.locale());
    }

    private void publishSeedEntryPronunciationOnly(
            String pack, Map<String, Object> entry, String lexemeId, Map<String, Object> fields) {
        String ipa = fieldText(fields, "phoneticFr", "phoneticDe");
        String assetId = fieldText(fields, "audioFrAssetId", "audioDeAssetId");
        LexemePronunciation pronunciation = commands.upsertPronunciation(pack, lexemeId,
                Map.of("accent", "DE-STANDARD", "ipa", ipa, "audioAssetId", assetId, "sourceType", "TTS"),
                editor(), key(), REQUEST);
        assertEquals("DE-STANDARD", pronunciation.accent());
    }

    @Test
    void scratchPackNegativesStayIsolated() {
        String pack = "VOCAB-FR-SCRATCH";
        Map<String, Object> fields = Map.of(
                "headword", "scratch",
                "language", "fr-FR",
                "pos", List.of("NOUN"),
                "gender", "MASCULINE",
                "number", "SINGULAR",
                "senses", List.of(Map.of("pos", "NOUN", "meaningLocal", "scratch (mot test)")));
        LexemeCommandService.LexemeResult created =
                commands.upsert(pack, fields, "lx_fr_scratch_1", editor(), key(), REQUEST);
        // Negative: publish without approval is rejected and leaves the draft intact.
        assertThrows(ContentOperationException.class, () -> commands.publish(
                pack, created.lexemeId(), "SEED_PACK_RELEASE", publisher(), key(), REQUEST));
        assertEquals(LexemeAvailability.DRAFT,
                commands.current(pack, created.lexemeId(), editor()).availability());
        // Negative: the final review requires a completed first review.
        commands.submit(pack, created.lexemeId(), editor(), key(), REQUEST);
        assertThrows(ContentOperationException.class, () -> commands.reviewFinal(
                pack, created.lexemeId(), ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST));
        LexemeAvailability anyStatus = null;
        assertEquals(0, lexemes.search(FR_PACK, null, null, anyStatus, "fr-FR", 100, null).size());
    }
}
