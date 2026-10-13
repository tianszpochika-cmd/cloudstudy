package com.englishflow.content.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** P2-1: IN_REVIEW rows migrated before V31 have no submitted_by; the author must never pass a review. */
class LegacyReviewAuthorTest {

    private static final Instant NOW = Instant.parse("2026-10-13T00:00:00Z");

    private static void assertCode(String code, Runnable action) {
        assertEquals(code, assertThrows(ContentOperationException.class, action::run).code());
    }

    /** Legacy IN_REVIEW item, nobody reviewed yet: updatedBy is still the author. */
    private static ContentItem legacyPendingItem() {
        ContentItem item = ContentItem.create("q_legacy_1", "platform", "PACK-L", "QUESTION", "stem",
                Map.of("options", List.of("a", "b"), "answerIndex", 0), null, null, "author-1", NOW);
        item.submit("author-1", NOW);
        item.restoreTrail(ReviewTrail.EMPTY);
        return item;
    }

    /** Legacy IN_REVIEW item already first-reviewed before V31: updatedBy now points at reviewer-1. */
    private static ContentItem legacyFirstReviewedItem() {
        return new ContentItem("q_legacy_2", "platform", "PACK-L", "QUESTION", "stem",
                ItemAvailability.IN_REVIEW, 3L, "author-1", "reviewer-1", "reviewer-1", null, null, null, null,
                Map.of(), NOW, NOW);
    }

    @Test
    void firstReviewPinsTheInferredSubmitterSoTheAuthorCannotFinalReview() {
        ContentItem item = legacyPendingItem();
        assertCode("ITEM_SELF_APPROVAL_DENIED", () -> item.reviewFirst("author-1", NOW));
        item.reviewFirst("reviewer-1", NOW);
        assertEquals("author-1", item.trail().submittedBy());
        assertCode("ITEM_SELF_APPROVAL_DENIED", () -> item.reviewFinal("author-1", NOW));
        item.reviewFinal("reviewer-2", NOW);
        assertEquals(ItemAvailability.APPROVED, item.availability());
    }

    @Test
    void unknownAuthorAfterFirstReviewDeniesApprovalButAllowsReject() {
        ContentItem creator = legacyFirstReviewedItem();
        assertCode("ITEM_SELF_APPROVAL_DENIED", () -> creator.reviewFinal("author-1", NOW));

        ContentItem uncertain = legacyFirstReviewedItem();
        assertCode("ITEM_REVIEW_AUTHOR_UNKNOWN", () -> uncertain.reviewFinal("reviewer-2", NOW));
        assertCode("ITEM_SELF_APPROVAL_DENIED", () -> uncertain.reject(ReviewStage.FINAL_REVIEW,
                ReviewDecision.REJECTED, "author-1", "self", NOW));

        uncertain.reject(ReviewStage.FINAL_REVIEW, ReviewDecision.CHANGES_REQUESTED, "reviewer-2", "请重新送审", NOW);
        assertEquals(ItemAvailability.DRAFT, uncertain.availability());
        uncertain.submit("author-1", NOW);
        assertEquals("author-1", uncertain.trail().submittedBy());
    }

    @Test
    void legacyLexemeAuthorCannotReviewEitherStage() {
        Lexeme lexeme = Lexeme.create("lx_legacy_1", "platform", "VOCAB-L", "habit", "en-US", "A2",
                Map.of("headword", "habit"), "author-1", NOW);
        lexeme.submit("author-1", NOW);
        lexeme.restoreTrail(ReviewTrail.EMPTY);
        assertCode("LEXEME_SELF_APPROVAL_DENIED", () -> lexeme.reviewFirst("author-1", NOW));
        lexeme.reviewFirst("reviewer-1", NOW);
        assertCode("LEXEME_SELF_APPROVAL_DENIED", () -> lexeme.reviewFinal("author-1", NOW));
        assertCode("LEXEME_SELF_APPROVAL_DENIED", () -> lexeme.reject(ReviewStage.FINAL_REVIEW,
                ReviewDecision.REJECTED, "author-1", "self", NOW));
        lexeme.reviewFinal("reviewer-2", NOW);
        assertEquals(LexemeAvailability.APPROVED, lexeme.availability());
    }
}
