package com.englishflow.content.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;

/** Aggregate pointer rules and rehydration corruption guards for {@link ContentDefinition}. */
@DisplayName("ContentDefinition aggregate pointer and rehydration rules")
class ContentDefinitionTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");

    private static ContentDefinition freshContent() {
        return ContentDefinition.create(
                ContentId.of("cnt_def_1"), "platform", "vocab-def-1", ContentKind.VOCABULARY,
                "Title", "en-US", "A1", "ONB", "editor-1", NOW);
    }

    private static ContentVersion draft(ContentVersionId id, int number) {
        return ContentVersion.draft(id, number, ContentKind.VOCABULARY,
                new ContentPayload(Map.of("term", "cat")), null, "editor-1", "note", NOW);
    }

    @Test
    @DisplayName("drafts are numbered sequentially from the highest existing version")
    void draftVersionNumbering() {
        ContentDefinition content = freshContent();
        ContentVersion v1 = content.addDraft(ContentVersionId.of(1001L), Map.of("term", "cat"), null, "editor-1", "n", NOW);
        ContentVersion v2 = content.addDraft(ContentVersionId.of(1002L), Map.of("term", "dog"), null, "editor-1", "n", NOW);
        assertEquals(1, v1.versionNumber());
        assertEquals(2, v2.versionNumber());
        assertEquals(2, content.versions().size());
    }

    @Test
    @DisplayName("a question draft requires an answer rule")
    void questionDraftRequiresAnswerRule() {
        ContentDefinition content = ContentDefinition.create(
                ContentId.of("cnt_def_q"), "platform", "q-def-1", ContentKind.QUESTION,
                "Title", "en-US", "A1", "ONB", "editor-1", NOW);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> content.addDraft(ContentVersionId.of(1L), Map.of("prompt", "x"), null, "editor-1", "n", NOW));
        assertEquals("QUESTION_ANSWER_RULE_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("the published pointer must reference a published version")
    void publishedPointerRequiresPublishedVersion() {
        ContentDefinition content = freshContent();
        ContentVersion draft = content.addDraft(ContentVersionId.of(1L), Map.of("term", "cat"), null, "editor-1", "n", NOW);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> content.setPublished(draft));
        assertEquals("CONTENT_POINTER_INVALID", ex.code());
    }

    @Test
    @DisplayName("clearing the published pointer only works for the current published version")
    void clearPublishedRequiresCurrent() {
        ContentDefinition content = freshContent();
        ContentRights rights = new ContentRights("src", "lic", CopyrightStatus.ACTIVE, true,
                Set.of("PUBLIC", "LEARNER", "ASSESSMENT"), NOW.minusSeconds(60), null, "evidence-1");
        ContentVersion v1 = content.addDraft(ContentVersionId.of(1L), Map.of("term", "cat"), rights, "editor-1", "n", NOW);
        v1.submitForReview("editor-1");
        v1.review(ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, "r1", NOW);
        v1.review(ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, "r2", NOW);
        v1.publish("p1", NOW);
        content.setPublished(v1);

        ContentVersion v2 = content.addDraft(ContentVersionId.of(2L), Map.of("term", "dog"), rights, "editor-1", "n", NOW);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> content.clearPublished(v2));
        assertEquals("CONTENT_POINTER_CONFLICT", ex.code());

        content.clearPublished(v1);
        assertTrue(content.currentPublishedVersionId().isEmpty());
    }

    @Test
    @DisplayName("projection revision advances on each publication")
    void projectionRevisionAdvances() {
        ContentDefinition content = freshContent();
        assertEquals(0L, content.projectionVersion());
        ContentDefinition.ProjectionRevision revision = content.advanceProjectionRevision();
        assertEquals(1L, revision.projectionVersion());
        assertEquals(1L, revision.contentEpoch());
    }

    @Test
    @DisplayName("rehydration rebuilds a published content aggregate")
    void rehydrateHappyPath() {
        ContentVersion version = ContentVersion.rehydrate(
                ContentVersionId.of(1L), 1, ContentKind.VOCABULARY, Map.of("term", "cat"),
                ContentPayloadHash.sha256(Map.of("term", "cat")), null, "editor-1", "note", NOW,
                ContentVersionStatus.PUBLISHED, null, null, null, NOW, null, null, 0, 0, 1L);
        ContentDefinition content = ContentDefinition.rehydrate(
                ContentId.of("cnt_def_1"), "platform", "vocab-def-1", ContentKind.VOCABULARY,
                "Title", "en-US", "A1", "ONB", "editor-1", NOW,
                List.of(version), version.versionId(), 5L, 3L);
        assertEquals(Optional.of(version.versionId()), content.currentPublishedVersionId());
        assertEquals(5L, content.contentEpoch());
        assertTrue(content.currentPublishedVersion().isPresent());
    }

    @Test
    @DisplayName("rehydration rejects a published pointer that does not reference a published version")
    void rehydrateCorruptPointer() {
        ContentVersion draft = ContentVersion.rehydrate(
                ContentVersionId.of(1L), 1, ContentKind.VOCABULARY, Map.of("term", "cat"),
                ContentPayloadHash.sha256(Map.of("term", "cat")), null, "editor-1", "note", NOW,
                ContentVersionStatus.DRAFT, null, null, null, null, null, null, 0, 0, 1L);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentDefinition.rehydrate(
                        ContentId.of("cnt_def_1"), "platform", "vocab-def-1", ContentKind.VOCABULARY,
                        "Title", "en-US", "A1", "ONB", "editor-1", NOW,
                        List.of(draft), draft.versionId(), 1L, 1L));
        assertEquals("CONTENT_FACT_CORRUPT", ex.code());
    }

    @Test
    @DisplayName("rehydration rejects negative epoch/projection counters")
    void rehydrateNegativeCounters() {
        ContentVersion version = ContentVersion.rehydrate(
                ContentVersionId.of(1L), 1, ContentKind.VOCABULARY, Map.of("term", "cat"),
                ContentPayloadHash.sha256(Map.of("term", "cat")), null, "editor-1", "note", NOW,
                ContentVersionStatus.PUBLISHED, null, null, null, NOW, null, null, 0, 0, 1L);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentDefinition.rehydrate(
                        ContentId.of("cnt_def_1"), "platform", "vocab-def-1", ContentKind.VOCABULARY,
                        "Title", "en-US", "A1", "ONB", "editor-1", NOW,
                        List.of(version), version.versionId(), -1L, 1L));
        assertEquals("CONTENT_FACT_CORRUPT", ex.code());
    }

    @Test
    @DisplayName("content code must match the safe identifier pattern")
    void contentCodeValidation() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentDefinition.create(
                        ContentId.of("cnt_def_1"), "platform", "bad code!", ContentKind.VOCABULARY,
                        "Title", "en-US", "A1", "ONB", "editor-1", NOW));
        assertEquals("CONTENT_FIELD_INVALID", ex.code());
    }

    @Test
    @DisplayName("a rehydrated version rejects a stale payload hash")
    void rehydrateStaleHash() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentVersion.rehydrate(
                        ContentVersionId.of(1L), 1, ContentKind.VOCABULARY, Map.of("term", "cat"),
                        "deadbeef", null, "editor-1", "note", NOW,
                        ContentVersionStatus.PUBLISHED, null, null, null, NOW, null, null, 0, 0, 1L));
        assertEquals("CONTENT_FACT_CORRUPT", ex.code());
    }
}
