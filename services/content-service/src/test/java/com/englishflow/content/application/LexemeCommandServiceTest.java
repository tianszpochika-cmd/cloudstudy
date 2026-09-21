package com.englishflow.content.application;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryLexemeRepository;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.LexemeAvailability;
import com.englishflow.content.domain.LexemePronunciation;
import com.englishflow.content.domain.ReviewDecision;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** B1 word-master tests: lifecycle, four-eyes, idempotency, version guard and pronunciation QC. */
@DisplayName("LexemeCommandService word-master lifecycle")
class LexemeCommandServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-lexeme-001", "0123456789abcdef0123456789abcdef");
    private static final String PACK = "VOCAB-PHASE1";

    private InMemoryLexemeRepository lexemes;
    private InMemoryContentOutbox outbox;
    private LexemeCommandService commands;
    private final AtomicInteger keys = new AtomicInteger();

    @BeforeEach
    void setUp() {
        lexemes = new InMemoryLexemeRepository();
        outbox = new InMemoryContentOutbox();
        commands = new LexemeCommandService(
                new InMemoryContentRepository(), lexemes, outbox,
                new InMemoryContentIdempotency(), CLOCK);
    }

    private ContentIdempotencyKey key() {
        return new ContentIdempotencyKey("lexeme-test-key-" + keys.incrementAndGet() + "-idempotency");
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

    private static Map<String, Object> fields() {
        return Map.of(
                "headword", "habit",
                "lemma", "habit",
                "pos", List.of("NOUN"),
                "cefr", "A2",
                "difficulty", 2,
                "phoneticUS", "ˈhæbɪt",
                "phoneticUK", "ˈhæbɪt",
                "senses", List.of(Map.of("pos", "NOUN", "meaningCn", "习惯",
                        "examples", List.of(Map.of("en", "Build a habit.", "cn", "养成一个习惯。")))),
                "tags", List.of("daily-life"));
    }

    @Test
    void fullLifecycleDraftToPublished() {
        LexemeCommandService.LexemeResult created =
                commands.upsert(PACK, fields(), null, editor(), key(), REQUEST);
        assertEquals(LexemeAvailability.DRAFT, created.availability());

        commands.submit(PACK, created.lexemeId(), editor(), key(), REQUEST);
        commands.reviewFirst(PACK, created.lexemeId(), ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
        commands.reviewFinal(PACK, created.lexemeId(), ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
        LexemeCommandService.LexemeResult published = commands.publish(
                PACK, created.lexemeId(), "PACK_RELEASE", publisher(), key(), REQUEST);
        assertEquals(LexemeAvailability.PUBLISHED, published.availability());
        assertTrue(published.stateVersion() > created.stateVersion());
        assertTrue(outbox.events().size() >= 1, "publish must emit an outbox fact");
    }

    @Test
    void authorCannotSelfReviewFinal() {
        LexemeCommandService.LexemeResult created =
                commands.upsert(PACK, fields(), null, editor(), key(), REQUEST);
        commands.submit(PACK, created.lexemeId(), editor(), key(), REQUEST);
        commands.reviewFirst(PACK, created.lexemeId(), ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
        ContentActor sameAsFirst = new ContentActor("reviewer-1", "platform",
                Set.of("review-l1", "review-l2"), Set.of("content:review:first", "content:review:final"), false);
        assertThrows(ContentOperationException.class, () -> commands.reviewFinal(
                PACK, created.lexemeId(), ReviewDecision.APPROVED, sameAsFirst, key(), REQUEST));
    }

    @Test
    void publishWithoutApprovalIsRejected() {
        LexemeCommandService.LexemeResult created =
                commands.upsert(PACK, fields(), null, editor(), key(), REQUEST);
        assertThrows(ContentOperationException.class, () -> commands.publish(
                PACK, created.lexemeId(), "PACK_RELEASE", publisher(), key(), REQUEST));
    }

    @Test
    void upsertIsIdempotentOnReplay() {
        LexemeCommandService.LexemeResult first =
                commands.upsert(PACK, fields(), "lx_fixed_001", editor(), key(), REQUEST);
        ContentIdempotencyKey replayKey = new ContentIdempotencyKey("lexeme-replay-key-idempotency");
        LexemeCommandService.LexemeResult replayed =
                commands.upsert(PACK, fields(), "lx_fixed_001", editor(), replayKey, REQUEST);
        assertEquals(first.lexemeId(), replayed.lexemeId());
        LexemeAvailability anyStatus = null;
        assertEquals(1, lexemes.search(PACK, "habit", (String) null, anyStatus, 100, (String) null).size());
    }

    @Test
    void searchFiltersByHeadwordAndCefr() {
        commands.upsert(PACK, fields(), null, editor(), key(), REQUEST);
        LexemeAvailability anyStatus = null;
        assertEquals(1, lexemes.search(PACK, "hab", (String) null, anyStatus, 100, (String) null).size());
        assertEquals(1, lexemes.search(PACK, (String) null, "A2", anyStatus, 100, (String) null).size());
        assertEquals(0, lexemes.search(PACK, (String) null, "C2", anyStatus, 100, (String) null).size());
        assertEquals(0, lexemes.search(PACK, "unknown-word", (String) null, anyStatus, 100, (String) null).size());
    }

    @Test
    void pronunciationQcFlow() {
        LexemeCommandService.LexemeResult created =
                commands.upsert(PACK, fields(), null, editor(), key(), REQUEST);
        LexemePronunciation pronunciation = commands.upsertPronunciation(PACK, created.lexemeId(),
                Map.of("accent", "US", "ipa", "ˈhæbɪt", "audioAssetId", "media-asset-1", "sourceType", "HUMAN"),
                editor(), key(), REQUEST);
        assertEquals("PENDING", pronunciation.qcStatus());
        LexemePronunciation cleaned = commands.reviewPronunciation(PACK, created.lexemeId(),
                Map.of("pronunciationId", pronunciation.pronunciationId(), "qcStatus", "CLEAN"),
                "QC_PASS", editor(), key(), REQUEST);
        assertEquals("CLEAN", cleaned.qcStatus());
        assertEquals("editor-1", cleaned.qcBy());
        assertEquals(1, commands.pronunciations(PACK, created.lexemeId(), editor()).size());
    }

    @Test
    void invalidFieldsAreRejected() {
        assertThrows(ContentOperationException.class, () -> commands.upsert(
                PACK, Map.of("headword", "habit", "difficulty", 9), null, editor(), key(), REQUEST));
        assertThrows(ContentOperationException.class, () -> commands.upsert(
                PACK, Map.of("headword", "habit", "senses", List.of(Map.of("pos", "NOUN"))),
                null, editor(), key(), REQUEST));
    }
}
