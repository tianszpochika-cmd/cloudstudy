package com.englishflow.content.application;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentItemRepository;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryLexemeRepository;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ItemAvailability;
import com.englishflow.content.domain.Lexeme;
import com.englishflow.content.domain.LexemeAvailability;
import com.englishflow.content.domain.ReviewDecision;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Content-ops R2: reject/rework loop, author/reviewer separation, post-publish revision, optimistic lock. */
@DisplayName("Row review loop: reject → rework → re-review, four-eyes, revisions, version guard")
class RowReviewLoopTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-13T00:00:00Z"), ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-review-loop", "0123456789abcdef0123456789abcdef");
    private static final String PACK = "VOCAB-PHASE1";
    private final AtomicInteger keys = new AtomicInteger();

    private ContentIdempotencyKey key() {
        return new ContentIdempotencyKey("review-loop-key-" + keys.incrementAndGet() + "-idempotency");
    }

    private static ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor"), Set.of("content:write"), false);
    }

    private static ContentActor otherEditor() {
        return new ContentActor("editor-2", "platform", Set.of("content-editor"), Set.of("content:write"), false);
    }

    /** One account holding editor + both review permissions: must still not approve its own submission. */
    private static ContentActor superEditor() {
        return new ContentActor("lead-1", "platform", Set.of("content-editor", "review-l1", "review-l2"),
                Set.of("content:write", "content:review:first", "content:review:final"), false);
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

    private static void assertCode(String code, Runnable action) {
        ContentOperationException error = assertThrows(ContentOperationException.class, action::run);
        assertEquals(code, error.code());
    }

    @Nested
    @DisplayName("Lexeme")
    class LexemeLoop {

        private InMemoryLexemeRepository repo;
        private InMemoryContentOutbox outbox;
        private LexemeCommandService commands;

        @BeforeEach
        void setUp() {
            repo = new InMemoryLexemeRepository();
            outbox = new InMemoryContentOutbox();
            commands = new LexemeCommandService(new InMemoryContentRepository(), repo, outbox,
                    new InMemoryContentIdempotency(), CLOCK);
        }

        private Map<String, Object> fields(String meaning) {
            Map<String, Object> fields = new HashMap<>();
            fields.put("headword", "habit");
            fields.put("lemma", "habit");
            fields.put("pos", List.of("NOUN"));
            fields.put("cefr", "A2");
            fields.put("senses", List.of(Map.of("pos", "NOUN", "meaningCn", meaning)));
            return fields;
        }

        private Lexeme row(String id) {
            return repo.findById(id).orElseThrow();
        }

        private String submitted() {
            String id = commands.upsert(PACK, fields("习惯"), null, 0L, editor(), key(), REQUEST).lexemeId();
            commands.submit(PACK, id, editor(), key(), REQUEST);
            return id;
        }

        @Test
        void firstReviewRejectReturnsToDraftWithReasonAndAudit() {
            String id = submitted();
            commands.reviewFirst(PACK, id, ReviewDecision.CHANGES_REQUESTED, "释义缺少例句", reviewerL1(), key(), REQUEST);
            Lexeme lexeme = row(id);
            assertEquals(LexemeAvailability.DRAFT, lexeme.availability());
            assertNull(lexeme.firstReviewer());
            assertEquals("CHANGES_REQUESTED_FIRST", lexeme.trail().lastDecision());
            assertEquals("释义缺少例句", lexeme.trail().lastNote());
            assertEquals("reviewer-1", lexeme.trail().lastReviewer());
            assertEquals(1, outbox.countByType("content.lexeme.review-rejected.v1"));
            assertEquals(1, outbox.countByType("content.lexeme.submitted.v1"));
        }

        @Test
        void reworkResubmitAndReReviewReachesPublished() {
            String id = submitted();
            commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
            commands.reviewFinal(PACK, id, ReviewDecision.REJECTED, "例句有版权问题", reviewerL2(), key(), REQUEST);
            Lexeme rejected = row(id);
            assertEquals(LexemeAvailability.DRAFT, rejected.availability());
            assertNull(rejected.firstReviewer(), "both reviews must restart after a rejection");

            commands.upsert(PACK, fields("习惯；惯例"), id, rejected.stateVersion(), editor(), key(), REQUEST);
            commands.submit(PACK, id, editor(), key(), REQUEST);
            assertCode("LEXEME_REVIEW_ORDER_INVALID", () -> commands.reviewFinal(
                    PACK, id, ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST));
            commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
            commands.reviewFinal(PACK, id, ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
            commands.publish(PACK, id, "PACK_RELEASE", publisher(), key(), REQUEST);
            assertEquals(LexemeAvailability.PUBLISHED, row(id).availability());
            assertEquals(2, outbox.countByType("content.lexeme.submitted.v1"));
        }

        @Test
        void rejectWithoutReasonIsRefused() {
            String id = submitted();
            assertCode("LEXEME_REJECT_REASON_REQUIRED", () -> commands.reviewFirst(
                    PACK, id, ReviewDecision.REJECTED, "  ", reviewerL1(), key(), REQUEST));
            assertEquals(LexemeAvailability.IN_REVIEW, row(id).availability());
        }

        @Test
        void draftCannotBeRejectedOrReviewed() {
            String id = commands.upsert(PACK, fields("习惯"), null, 0L, editor(), key(), REQUEST).lexemeId();
            assertCode("LEXEME_STATE_INVALID", () -> commands.reviewFirst(
                    PACK, id, ReviewDecision.REJECTED, "x", reviewerL1(), key(), REQUEST));
        }

        @Test
        void submitterCannotApproveOrRejectOwnSubmission() {
            String id = commands.upsert(PACK, fields("习惯"), null, 0L, superEditor(), key(), REQUEST).lexemeId();
            commands.submit(PACK, id, superEditor(), key(), REQUEST);
            assertCode("LEXEME_SELF_APPROVAL_DENIED", () -> commands.reviewFirst(
                    PACK, id, ReviewDecision.APPROVED, superEditor(), key(), REQUEST));
            assertCode("LEXEME_SELF_APPROVAL_DENIED", () -> commands.reviewFirst(
                    PACK, id, ReviewDecision.REJECTED, "自己退回", superEditor(), key(), REQUEST));
            commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
            assertCode("LEXEME_SELF_APPROVAL_DENIED", () -> commands.reviewFinal(
                    PACK, id, ReviewDecision.APPROVED, superEditor(), key(), REQUEST));
            assertEquals("lead-1", row(id).trail().submittedBy());
        }

        @Test
        void editingPublishedOpensRevisionThatKeepsLiveCopy() {
            String id = submitted();
            commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
            commands.reviewFinal(PACK, id, ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
            commands.publish(PACK, id, "PACK_RELEASE", publisher(), key(), REQUEST);
            long live = row(id).stateVersion();

            commands.upsert(PACK, fields("习惯（修订）"), id, live, otherEditor(), key(), REQUEST);
            Lexeme revision = row(id);
            assertEquals(LexemeAvailability.DRAFT, revision.availability());
            assertTrue(revision.trail().revisionOfLive());
            assertTrue(revision.isLive(), "learners keep the published copy while the revision is drafted");
            assertTrue(String.valueOf(revision.publishedFields()).contains("习惯"));
            assertFalse(String.valueOf(revision.publishedFields()).contains("修订"));
            assertEquals(1, outbox.countByType("content.lexeme.revision-opened.v1"));
            assertCode("LEXEME_REVISION_LIVE", () -> commands.archive(
                    PACK, id, "CLEANUP", editor(), key(), REQUEST));

            commands.submit(PACK, id, otherEditor(), key(), REQUEST);
            commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
            commands.reviewFinal(PACK, id, ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
            commands.publish(PACK, id, "PACK_RELEASE", publisher(), key(), REQUEST);
            Lexeme republished = row(id);
            assertFalse(republished.trail().revisionOfLive());
            assertTrue(String.valueOf(republished.publishedFields()).contains("修订"));
            assertEquals(3, republished.contentVersion());
        }

        @Test
        void unpublishWithdrawsLiveCopyOfARevisionDraft() {
            String id = submitted();
            commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
            commands.reviewFinal(PACK, id, ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
            commands.publish(PACK, id, "PACK_RELEASE", publisher(), key(), REQUEST);
            commands.upsert(PACK, fields("修订"), id, row(id).stateVersion(), editor(), key(), REQUEST);
            commands.unpublish(PACK, id, "TAKEDOWN", publisher(), key(), REQUEST);
            Lexeme row = row(id);
            assertEquals(LexemeAvailability.DRAFT, row.availability());
            assertFalse(row.isLive());
            commands.archive(PACK, id, "CLEANUP", editor(), key(), REQUEST);
            assertEquals(LexemeAvailability.ARCHIVED, row(id).availability());
        }

        @Test
        void inReviewRowIsFrozen() {
            String id = submitted();
            assertCode("LEXEME_STATE_INVALID", () -> commands.upsert(
                    PACK, fields("改"), id, row(id).stateVersion(), editor(), key(), REQUEST));
        }

        @Test
        void staleSaveIsAConflict() {
            String id = commands.upsert(PACK, fields("习惯"), null, 0L, editor(), key(), REQUEST).lexemeId();
            long seen = row(id).stateVersion();
            commands.upsert(PACK, fields("A 的保存"), id, seen, editor(), key(), REQUEST);
            assertCode("LEXEME_VERSION_CONFLICT", () -> commands.upsert(
                    PACK, fields("B 的保存"), id, seen, otherEditor(), key(), REQUEST));
            assertTrue(String.valueOf(row(id).fields()).contains("A 的保存"));
        }

        @Test
        void createOverExistingHeadwordIsAConflict() {
            commands.upsert(PACK, fields("习惯"), null, 0L, editor(), key(), REQUEST);
            assertCode("LEXEME_DUPLICATE", () -> commands.upsert(
                    PACK, fields("覆盖"), null, 0L, otherEditor(), key(), REQUEST));
        }
    }

    @Nested
    @DisplayName("Content item")
    class ItemLoop {

        private InMemoryContentItemRepository repo;
        private InMemoryContentOutbox outbox;
        private ContentItemCommandService commands;

        @BeforeEach
        void setUp() {
            repo = new InMemoryContentItemRepository();
            outbox = new InMemoryContentOutbox();
            commands = new ContentItemCommandService(repo, outbox, new InMemoryContentIdempotency(), CLOCK);
        }

        private Map<String, Object> input(String explanation) {
            return Map.of(
                    "kind", "QUESTION",
                    "stem", "Choose the correct word: I ___ a habit.",
                    "fields", Map.of(
                            "options", List.of("build", "builds", "building"),
                            "answerIndex", 0,
                            "explanation", explanation,
                            "cefr", "A2"));
        }

        private ContentItem row(String id) {
            return repo.findById(id).orElseThrow();
        }

        private String submitted(ContentActor author) {
            String id = commands.upsert(PACK, input("固定搭配"), null, 0L, author, key(), REQUEST).itemId();
            commands.submit(PACK, id, author, key(), REQUEST);
            return id;
        }

        @Test
        void rejectReworkReReview() {
            String id = submitted(editor());
            commands.reviewFirst(PACK, id, ReviewDecision.REJECTED, "答案解析不完整", reviewerL1(), key(), REQUEST);
            ContentItem rejected = row(id);
            assertEquals(ItemAvailability.DRAFT, rejected.availability());
            assertEquals("答案解析不完整", rejected.trail().lastNote());
            commands.upsert(PACK, input("build a habit 是固定搭配"), id, rejected.stateVersion(), editor(), key(), REQUEST);
            commands.submit(PACK, id, editor(), key(), REQUEST);
            commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
            commands.reviewFinal(PACK, id, ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
            assertEquals(ItemAvailability.APPROVED, row(id).availability());
            assertEquals(1, outbox.countByType("content.item.review-rejected.v1"));
            assertEquals(2, outbox.countByType("content.item.review-approved.v1"));
        }

        @Test
        void selfApprovalDenied() {
            String id = submitted(superEditor());
            assertCode("ITEM_SELF_APPROVAL_DENIED", () -> commands.reviewFirst(
                    PACK, id, ReviewDecision.APPROVED, superEditor(), key(), REQUEST));
        }

        @Test
        void rejectNeedsReason() {
            String id = submitted(editor());
            assertCode("ITEM_REJECT_REASON_REQUIRED", () -> commands.reviewFirst(
                    PACK, id, ReviewDecision.REJECTED, null, reviewerL1(), key(), REQUEST));
        }

        @Test
        void publishedRevisionAndStaleSave() {
            String id = submitted(editor());
            commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
            commands.reviewFinal(PACK, id, ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
            commands.publish(PACK, id, "PACK_RELEASE", publisher(), key(), REQUEST);
            long seen = row(id).stateVersion();
            commands.upsert(PACK, input("修订"), id, seen, editor(), key(), REQUEST);
            assertTrue(row(id).isLive());
            assertEquals(ItemAvailability.DRAFT, row(id).availability());
            assertCode("ITEM_VERSION_CONFLICT", () -> commands.upsert(
                    PACK, input("旧页面保存"), id, seen, otherEditor(), key(), REQUEST));
            assertCode("ITEM_REVISION_LIVE", () -> commands.archive(
                    PACK, id, "CLEANUP", editor(), key(), REQUEST));
        }
    }
}
