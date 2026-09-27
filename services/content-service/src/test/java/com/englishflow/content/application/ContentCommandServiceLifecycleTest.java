package com.englishflow.content.application;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.InMemoryValidationReportStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Command-layer tests: full lifecycle, four-eyes, authorization, tenant scope and idempotency. */
@DisplayName("ContentCommandService lifecycle and authorization")
class ContentCommandServiceLifecycleTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-command-001", "0123456789abcdef0123456789abcdef");

    private InMemoryContentRepository repository;
    private InMemoryContentOutbox outbox;
    private InMemoryPublicProjectionStore projections;
    private RecordingContentCacheInvalidator invalidator;
    private ContentCommandService commands;
    private ContentId contentId;

    @BeforeEach
    void setUp() {
        repository = new InMemoryContentRepository();
        outbox = new InMemoryContentOutbox();
        projections = new InMemoryPublicProjectionStore();
        invalidator = new RecordingContentCacheInvalidator();
        commands = new ContentCommandService(repository, outbox, new InMemoryContentIdempotency(),
                projections, invalidator, new InMemoryValidationReportStore(), CLOCK);
        contentId = new ContentId("cnt_cmd_1");
    }

    private static ContentRights publishableRights() {
        return new ContentRights("src", "lic", CopyrightStatus.ACTIVE, true,
                Set.of("PUBLIC", "LEARNER", "ASSESSMENT"), NOW.minusSeconds(60), null, "evidence-1");
    }

    private ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor"), Set.of("content:write"), false);
    }

    private ContentActor reviewerL1() {
        return new ContentActor("reviewer-1", "platform", Set.of("review-l1"), Set.of("content:review:first"), false);
    }

    private ContentActor reviewerL2() {
        return new ContentActor("reviewer-2", "platform", Set.of("review-l2"), Set.of("content:review:final"), false);
    }

    private ContentActor reviewerL1AsL2() {
        return new ContentActor("reviewer-1", "platform", Set.of("review-l2"), Set.of("content:review:final"), false);
    }

    private ContentActor publisher() {
        return new ContentActor("publisher-1", "platform", Set.of("content-publisher"), Set.of("content:publish"), false);
    }

    private ContentActor noRole() {
        return new ContentActor("stranger", "platform", Set.of(), Set.of(), false);
    }

    private ContentActor editorWithPublisherRole() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor", "content-publisher"),
                Set.of("content:write", "content:publish"), false);
    }

    private ContentActor editorWithReviewRole() {
        return new ContentActor("editor-1", "platform", Set.of("review-l1"),
                Set.of("content:review:first"), false);
    }

    private ContentActor otherTenant() {
        return new ContentActor("editor-1", "other-tenant", Set.of("content-editor"), Set.of("content:write"), false);
    }

    private ContentIdempotencyKey key(String v) {
        return new ContentIdempotencyKey(v + "-key-0000000000000000");
    }

    private void createContentAndVersion() {
        commands.createContent(new ContentCommandService.CreateContent(
                contentId, "vocab-cmd-1", ContentKind.VOCABULARY, "Title", "en-US", "A1", "ONB"),
                editor(), key("create"), REQUEST);
        commands.createVersion(new ContentCommandService.CreateVersion(
                contentId, new ContentVersionId(1001L), Map.of("term", "cat", "definition", "猫"),
                publishableRights(), "note"), editor(), key("createVer"), REQUEST);
    }

    @Test
    @DisplayName("full lifecycle publishes and emits exactly one published event")
    void fullLifecyclePublishesOnce() {
        createContentAndVersion();
        ContentVersionId versionId = new ContentVersionId(1001L);
        commands.submitForReview(new ContentCommandService.VersionCommand(contentId, versionId), editor(), key("submit"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, versionId, ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, null, null),
                reviewerL1(), key("r1"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, versionId, ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, null, null),
                reviewerL2(), key("r2"), REQUEST);

        commands.publish(new ContentCommandService.VersionCommand(contentId, versionId), publisher(), key("publish"), REQUEST);
        // Idempotent retry with the same key must not emit a second published event.
        commands.publish(new ContentCommandService.VersionCommand(contentId, versionId), publisher(), key("publish"), REQUEST);

        assertEquals(1L, outbox.countByType("content.version.published.v1"));
        assertEquals(1L, outbox.countByType("content.public_projection.invalidated.v1"));
        assertEquals(1, invalidator.invalidations().size());
    }

    @Test
    @DisplayName("createContent requires an editor role")
    void createRequiresEditor() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> commands.createContent(new ContentCommandService.CreateContent(
                        contentId, "vocab-cmd-1", ContentKind.VOCABULARY, "Title", "en-US", "A1", "ONB"),
                        noRole(), key("create"), REQUEST));
        assertEquals("CONTENT_EDITOR_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("a version command is denied across tenant scope")
    void tenantScopeDenied() {
        createContentAndVersion();
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> commands.createVersion(new ContentCommandService.CreateVersion(
                        contentId, new ContentVersionId(1002L), Map.of("term", "dog"),
                        publishableRights(), "note"), otherTenant(), key("createVerOther"), REQUEST));
        assertEquals("CONTENT_TENANT_DENIED", ex.code());
    }

    @Test
    @DisplayName("four-eyes blocks the editor from reviewing their own version")
    void fourEyesBlocksSelfReview() {
        createContentAndVersion();
        ContentVersionId versionId = new ContentVersionId(1001L);
        commands.submitForReview(new ContentCommandService.VersionCommand(contentId, versionId), editor(), key("submit"), REQUEST);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> commands.review(new ContentCommandService.ReviewCommand(
                        contentId, versionId, ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, null, null),
                        editorWithReviewRole(), key("r1"), REQUEST));
        assertEquals("FOUR_EYES_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("four-eyes blocks the editor from publishing their own version")
    void fourEyesBlocksSelfPublish() {
        createContentAndVersion();
        ContentVersionId versionId = new ContentVersionId(1001L);
        commands.submitForReview(new ContentCommandService.VersionCommand(contentId, versionId), editor(), key("submit"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, versionId, ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, null, null),
                reviewerL1(), key("r1"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, versionId, ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, null, null),
                reviewerL2(), key("r2"), REQUEST);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> commands.publish(new ContentCommandService.VersionCommand(contentId, versionId),
                        editorWithPublisherRole(), key("publish"), REQUEST));
        assertEquals("FOUR_EYES_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("unpublishing a non-current version is rejected")
    void unpublishNonCurrentRejected() {
        createContentAndVersion();
        ContentVersionId v1 = new ContentVersionId(1001L);
        commands.submitForReview(new ContentCommandService.VersionCommand(contentId, v1), editor(), key("submit"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, v1, ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, null, null),
                reviewerL1(), key("r1"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, v1, ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, null, null),
                reviewerL2(), key("r2"), REQUEST);
        commands.publish(new ContentCommandService.VersionCommand(contentId, v1), publisher(), key("publish"), REQUEST);

        commands.createVersion(new ContentCommandService.CreateVersion(
                contentId, new ContentVersionId(1002L), Map.of("term", "dog"),
                publishableRights(), "note"), editor(), key("createVer2"), REQUEST);
        ContentVersionId v2 = new ContentVersionId(1002L);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> commands.unpublish(new ContentCommandService.VersionCommand(contentId, v2),
                        publisher(), key("unpublish"), REQUEST));
        assertEquals("CONTENT_POINTER_CONFLICT", ex.code());
    }

    @Test
    @DisplayName("a question version without an answer rule is rejected")
    void questionWithoutAnswerRejected() {
        commands.createContent(new ContentCommandService.CreateContent(
                contentId, "q-cmd-1", ContentKind.QUESTION, "Title", "en-US", "A1", "ONB"),
                editor(), key("create"), REQUEST);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> commands.createVersion(new ContentCommandService.CreateVersion(
                        contentId, new ContentVersionId(2001L), Map.of("prompt", "choose"),
                        publishableRights(), "note"), editor(), key("createVer"), REQUEST));
        assertEquals("QUESTION_ANSWER_RULE_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("publishing a draft that was never approved is rejected")
    void publishWithoutApprovalRejected() {
        createContentAndVersion();
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> commands.publish(new ContentCommandService.VersionCommand(
                        contentId, new ContentVersionId(1001L)), publisher(), key("publish"), REQUEST));
        assertEquals("CONTENT_STATE_INVALID", ex.code());
    }

    @Test
    @DisplayName("publishing requires distinct first and final reviewers")
    void publishRequiresDualReview() {
        createContentAndVersion();
        ContentVersionId versionId = new ContentVersionId(1001L);
        commands.submitForReview(new ContentCommandService.VersionCommand(contentId, versionId), editor(), key("submit"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, versionId, ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, null, null),
                reviewerL1(), key("r1"), REQUEST);
        // The same person attempting the final review must be rejected (dual review required).
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> commands.review(new ContentCommandService.ReviewCommand(
                        contentId, versionId, ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, null, null),
                        reviewerL1AsL2(), key("r2"), REQUEST));
        assertEquals("DUAL_REVIEW_REQUIRED", ex.code());
    }
}
