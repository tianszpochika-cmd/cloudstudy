package com.englishflow.content.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure state-machine tests for {@link ContentVersion} covering normal, boundary and illegal
 * transitions of the draft / review / published lifecycle, and the four-eyes principle.
 */
@DisplayName("ContentVersion state machine")
class ContentVersionStateMachineTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final ContentVersionId VERSION_ID = ContentVersionId.of(1L);

    private static ContentRights publishableRights() {
        return new ContentRights("src-b9", "lic-b9", CopyrightStatus.ACTIVE, true,
                Set.of("PUBLIC", "LEARNER", "ASSESSMENT"), NOW.minusSeconds(60), null, "evidence-b9");
    }

    private static ContentVersion draft(String editor) {
        return ContentVersion.draft(VERSION_ID, 1, ContentKind.VOCABULARY,
                new ContentPayload(Map.of("term", "cat", "definition", "猫")),
                publishableRights(), editor, "note", NOW);
    }

    private static void approveAndPublish(ContentVersion version, String editor, String r1, String r2, String publisher) {
        version.submitForReview(editor);
        version.review(ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, r1, NOW);
        version.review(ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, r2, NOW);
        version.publish(publisher, NOW);
    }

    @Test
    @DisplayName("a freshly drafted version starts in DRAFT")
    void draftStartsInDraftState() {
        ContentVersion version = draft("editor-1");
        assertEquals(ContentVersionStatus.DRAFT, version.status());
        assertEquals("editor-1", version.editor());
        assertEquals(1, version.versionNumber());
        assertFalse(version.wasPublished());
        assertFalse(version.hasDualApproval());
    }

    @Test
    @DisplayName("submitForReview moves DRAFT to IN_REVIEW")
    void submitForReviewTransitionsToInReview() {
        ContentVersion version = draft("editor-1");
        version.submitForReview("editor-1");
        assertEquals(ContentVersionStatus.IN_REVIEW, version.status());
    }

    @Test
    @DisplayName("first review approval reaches APPROVED and records the reviewer")
    void firstReviewApprovalReachesApproved() {
        ContentVersion version = draft("editor-1");
        version.submitForReview("editor-1");
        version.review(ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, "reviewer-1", NOW);
        assertEquals(ContentVersionStatus.APPROVED, version.status());
        assertEquals("reviewer-1", version.firstReviewer().orElseThrow());
        assertEquals(0, version.reviewVersion(ReviewStage.FINAL_REVIEW));
    }

    @Test
    @DisplayName("final review approval establishes dual approval")
    void finalReviewApprovalSetsDualApproval() {
        ContentVersion version = draft("editor-1");
        version.submitForReview("editor-1");
        version.review(ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, "reviewer-1", NOW);
        version.review(ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, "reviewer-2", NOW);
        assertEquals("reviewer-2", version.finalReviewer().orElseThrow());
        assertTrue(version.hasDualApproval());
    }

    @Test
    @DisplayName("full approve then publish reaches PUBLISHED and records publication time")
    void fullApproveThenPublishReachesPublished() {
        ContentVersion version = draft("editor-1");
        approveAndPublish(version, "editor-1", "reviewer-1", "reviewer-2", "publisher-1");
        assertEquals(ContentVersionStatus.PUBLISHED, version.status());
        assertEquals("publisher-1", version.publisher().orElseThrow());
        assertTrue(version.wasPublished());
        assertEquals(NOW, version.publishedAt().orElseThrow());
    }

    @Test
    @DisplayName("four-eyes blocks the editor from reviewing their own version")
    void fourEyesBlocksEditorSelfReview() {
        ContentVersion version = draft("editor-1");
        version.submitForReview("editor-1");
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> version.review(ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, "editor-1", NOW));
        assertEquals("FOUR_EYES_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("four-eyes blocks the editor from publishing their own version")
    void fourEyesBlocksEditorSelfPublish() {
        ContentVersion version = draft("editor-1");
        approveAndPublish(version, "editor-1", "reviewer-1", "reviewer-2", "publisher-1");
        ContentVersion next = ContentVersion.draft(ContentVersionId.of(2L), 2, ContentKind.VOCABULARY,
                new ContentPayload(Map.of("term", "dog", "definition", "狗")),
                publishableRights(), "editor-1", "note", NOW);
        next.submitForReview("editor-1");
        next.review(ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, "reviewer-1", NOW);
        next.review(ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, "reviewer-2", NOW);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> next.publish("editor-1", NOW));
        assertEquals("FOUR_EYES_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("distinct first and final reviewers are required for publication")
    void dualReviewRequiredWhenFinalReviewerEqualsFirst() {
        ContentVersion version = draft("editor-1");
        version.submitForReview("editor-1");
        version.review(ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, "reviewer-1", NOW);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> version.review(ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, "reviewer-1", NOW));
        assertEquals("DUAL_REVIEW_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("a rejected review returns the version to DRAFT")
    void rejectReturnsToDraft() {
        ContentVersion version = draft("editor-1");
        version.submitForReview("editor-1");
        version.review(ReviewStage.FIRST_REVIEW, ReviewDecision.REJECTED, "reviewer-1", NOW);
        assertEquals(ContentVersionStatus.DRAFT, version.status());
        assertTrue(version.firstReviewer().isEmpty());
        assertEquals(1, version.reviewVersion(ReviewStage.FIRST_REVIEW));
    }

    @Test
    @DisplayName("submit is only allowed from DRAFT")
    void submitFromNonDraftFails() {
        ContentVersion version = draft("editor-1");
        version.submitForReview("editor-1");
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> version.submitForReview("editor-1"));
        assertEquals("CONTENT_STATE_INVALID", ex.code());
    }

    @Test
    @DisplayName("publish before approval is rejected")
    void publishBeforeApprovalFails() {
        ContentVersion version = draft("editor-1");
        version.submitForReview("editor-1");
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> version.publish("publisher-1", NOW));
        assertEquals("CONTENT_STATE_INVALID", ex.code());
    }

    @Test
    @DisplayName("final review before first review is rejected")
    void finalReviewBeforeFirstFails() {
        ContentVersion version = draft("editor-1");
        version.submitForReview("editor-1");
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> version.review(ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, "reviewer-2", NOW));
        assertEquals("CONTENT_STATE_INVALID", ex.code());
    }

    @Test
    @DisplayName("unpublish before publication is rejected")
    void unpublishBeforePublishFails() {
        ContentVersion version = draft("editor-1");
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> version.unpublish("publisher-1", NOW));
        assertEquals("CONTENT_STATE_INVALID", ex.code());
    }

    @Test
    @DisplayName("version facts are immutable after creation")
    void replaceDraftAlwaysImmutable() {
        ContentVersion version = draft("editor-1");
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> version.replaceDraft(new ContentPayload(Map.of("term", "x")),
                        publishableRights(), "note", "editor-1"));
        assertEquals("DRAFT_IMMUTABLE_AFTER_CREATION", ex.code());
    }

    @Test
    @DisplayName("rollback target must be approved or previously published")
    void publishRollbackRejectsInvalidTarget() {
        ContentVersion draft = draft("editor-1");
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> draft.publishRollback(ContentVersionId.of(99L), "publisher-1", NOW));
        assertEquals("ROLLBACK_TARGET_INVALID", ex.code());
    }

    @Test
    @DisplayName("negative version number is rejected at construction")
    void negativeVersionNumberRejected() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentVersion.draft(VERSION_ID, 0, ContentKind.VOCABULARY,
                        new ContentPayload(Map.of("term", "x")), publishableRights(), "editor-1", "note", NOW));
        assertEquals("CONTENT_VERSION_NUMBER_INVALID", ex.code());
    }

    @Test
    @DisplayName("draft rejects a null editor with a bad-request error")
    void draftRejectsNullEditor() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentVersion.draft(VERSION_ID, 1, ContentKind.VOCABULARY,
                        new ContentPayload(Map.of("term", "x")), publishableRights(), null, "note", NOW));
        assertEquals("ACTOR_INVALID", ex.code());
    }

    @Test
    @DisplayName("draft rejects a null payload")
    void draftRejectsNullPayload() {
        assertThrows(NullPointerException.class,
                () -> ContentVersion.draft(VERSION_ID, 1, ContentKind.VOCABULARY,
                        null, publishableRights(), "editor-1", "note", NOW));
    }
}
