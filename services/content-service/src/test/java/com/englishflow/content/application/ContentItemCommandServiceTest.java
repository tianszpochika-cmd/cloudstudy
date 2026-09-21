package com.englishflow.content.application;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentItemRepository;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ItemAvailability;
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

/** B2 row-level item tests: lifecycle, four-eyes, idempotency and validation. */
@DisplayName("ContentItemCommandService row-level lifecycle")
class ContentItemCommandServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-item-001", "0123456789abcdef0123456789abcdef");
    private static final String PACK = "VOCAB-PHASE1";

    private InMemoryContentItemRepository items;
    private InMemoryContentOutbox outbox;
    private ContentItemCommandService commands;
    private final AtomicInteger keys = new AtomicInteger();

    @BeforeEach
    void setUp() {
        items = new InMemoryContentItemRepository();
        outbox = new InMemoryContentOutbox();
        commands = new ContentItemCommandService(items, outbox, new InMemoryContentIdempotency(), CLOCK);
    }

    private ContentIdempotencyKey key() {
        return new ContentIdempotencyKey("item-test-key-" + keys.incrementAndGet() + "-idempotency");
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

    private static Map<String, Object> input() {
        return Map.of(
                "kind", "QUESTION",
                "stem", "Choose the correct word: I ___ a habit.",
                "fields", Map.of(
                        "options", List.of("build", "builds", "building"),
                        "answerIndex", 0,
                        "explanation", "build a habit is a fixed collocation",
                        "cefr", "A2"));
    }

    @Test
    void fullLifecycleDraftToPublished() {
        ContentItemCommandService.ItemResult created =
                commands.upsert(PACK, input(), null, editor(), key(), REQUEST);
        assertEquals(ItemAvailability.DRAFT, created.availability());

        commands.submit(PACK, created.itemId(), editor(), key(), REQUEST);
        commands.reviewFirst(PACK, created.itemId(), ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
        commands.reviewFinal(PACK, created.itemId(), ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
        ContentItemCommandService.ItemResult published = commands.publish(
                PACK, created.itemId(), "PACK_RELEASE", publisher(), key(), REQUEST);
        assertEquals(ItemAvailability.PUBLISHED, published.availability());
        assertTrue(outbox.events().size() >= 1, "publish must emit an outbox fact");
    }

    @Test
    void authorCannotSelfReviewFinal() {
        ContentItemCommandService.ItemResult created =
                commands.upsert(PACK, input(), null, editor(), key(), REQUEST);
        commands.submit(PACK, created.itemId(), editor(), key(), REQUEST);
        commands.reviewFirst(PACK, created.itemId(), ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
        ContentActor sameAsFirst = new ContentActor("reviewer-1", "platform",
                Set.of("review-l1", "review-l2"), Set.of("content:review:first", "content:review:final"), false);
        assertThrows(ContentOperationException.class, () -> commands.reviewFinal(
                PACK, created.itemId(), ReviewDecision.APPROVED, sameAsFirst, key(), REQUEST));
    }

    @Test
    void invalidKindAndOptionsAreRejected() {
        assertThrows(ContentOperationException.class, () -> commands.upsert(
                PACK, Map.of("kind", "NOPE", "stem", "x"), null, editor(), key(), REQUEST));
        assertThrows(ContentOperationException.class, () -> commands.upsert(
                PACK, Map.of("kind", "QUESTION", "stem", "x",
                        "fields", Map.of("options", List.of(1, 2, 3, 4, 5, 6, 7, 8, 9))),
                null, editor(), key(), REQUEST));
    }

    @Test
    void dictationFullLifecycleCreateReviewPublishUnpublish() {
        Map<String, Object> input = Map.of(
                "kind", "DICTATION",
                "stem", "Écoutez et écrivez : bonjour",
                "fields", Map.of(
                        "acceptedAnswers", List.of("bonjour"),
                        "mediaAssetId", "media-fr-dict-0001",
                        "language", "fr-FR",
                        "cefr", "A1"));
        ContentItemCommandService.ItemResult created =
                commands.upsert(PACK, input, null, editor(), key(), REQUEST);
        assertEquals(ItemAvailability.DRAFT, created.availability());
        assertTrue(created.itemId().startsWith("dc_"), "dictation rows use the dc_ id prefix");
        assertEquals("DICTATION", items.findById(created.itemId()).orElseThrow().kind());

        commands.submit(PACK, created.itemId(), editor(), key(), REQUEST);
        commands.reviewFirst(PACK, created.itemId(), ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
        commands.reviewFinal(PACK, created.itemId(), ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
        ContentItemCommandService.ItemResult published = commands.publish(
                PACK, created.itemId(), "PACK_RELEASE", publisher(), key(), REQUEST);
        assertEquals(ItemAvailability.PUBLISHED, published.availability());
        ContentItemCommandService.ItemResult unpublished = commands.unpublish(
                PACK, created.itemId(), "PACK_REVOKE", publisher(), key(), REQUEST);
        assertEquals(ItemAvailability.APPROVED, unpublished.availability());
        assertTrue(outbox.events().size() >= 2, "publish and unpublish must emit outbox facts");
    }

    @Test
    void shadowingFullLifecycle() {
        Map<String, Object> input = Map.of(
                "kind", "SHADOWING",
                "stem", "Suivez et répétez : bonjour",
                "fields", Map.of(
                        "promptText", "bonjour",
                        "mediaAssetId", "media-fr-shadow-0001",
                        "language", "fr-FR",
                        "cefr", "A1"));
        ContentItemCommandService.ItemResult created =
                commands.upsert(PACK, input, null, editor(), key(), REQUEST);
        assertTrue(created.itemId().startsWith("sh_"), "shadowing rows use the sh_ id prefix");
        assertEquals("SHADOWING", items.findById(created.itemId()).orElseThrow().kind());

        commands.submit(PACK, created.itemId(), editor(), key(), REQUEST);
        commands.reviewFirst(PACK, created.itemId(), ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
        commands.reviewFinal(PACK, created.itemId(), ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
        ContentItemCommandService.ItemResult published = commands.publish(
                PACK, created.itemId(), "PACK_RELEASE", publisher(), key(), REQUEST);
        assertEquals(ItemAvailability.PUBLISHED, published.availability());
    }
}
