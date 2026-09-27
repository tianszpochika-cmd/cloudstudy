package com.englishflow.content.application;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.InMemoryValidationReportStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.domain.AssessmentContentSnapshot;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentChannel;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentReadRequest;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.PublicContentProjection;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Read-side tests: publication gating, answer-leak prevention, assessment, tenant scope and catalog. */
@DisplayName("ContentReadService publication gating and projections")
class ContentReadServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-read-001", "0123456789abcdef0123456789abcdef");

    private InMemoryContentRepository repository;
    private InMemoryPublicProjectionStore projections;
    private ContentReadService reads;
    private ContentId contentId;
    private ContentVersionId versionId;

    @BeforeEach
    void setUp() {
        repository = new InMemoryContentRepository();
        projections = new InMemoryPublicProjectionStore();
        reads = new ContentReadService(repository, projections, CLOCK);
        contentId = new ContentId("cnt_read_1");
        versionId = new ContentVersionId(1001L);
    }

    private static ContentRights publishableRights() {
        return new ContentRights("src", "lic", CopyrightStatus.ACTIVE, true,
                Set.of("PUBLIC", "LEARNER", "ASSESSMENT"), NOW.minusSeconds(60), null, "evidence-1");
    }

    private ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor"), Set.of("content:write"), false);
    }

    private ContentActor publisher() {
        return new ContentActor("publisher-1", "platform", Set.of("content-publisher"), Set.of("content:publish"), false);
    }

    private ContentActor reviewerL1() {
        return new ContentActor("reviewer-1", "platform", Set.of("review-l1"), Set.of("content:review:first"), false);
    }

    private ContentActor reviewerL2() {
        return new ContentActor("reviewer-2", "platform", Set.of("review-l2"), Set.of("content:review:final"), false);
    }

    private ContentActor serviceActor() {
        return new ContentActor("assessment", "platform", Set.of(), Set.of("content:answer-rules:read"), true);
    }

    private ContentActor learner() {
        return new ContentActor("learner-1", "platform", Set.of(), Set.of(), false);
    }

    private ContentIdempotencyKey key(String v) {
        return new ContentIdempotencyKey(v + "-key-0000000000000000");
    }

    private ContentCommandService commands() {
        return new ContentCommandService(repository, new InMemoryContentOutbox(), new InMemoryContentIdempotency(),
                projections, new RecordingContentCacheInvalidator(), new InMemoryValidationReportStore(), CLOCK);
    }

    private void publishQuestion() {
        ContentCommandService commands = commands();
        commands.createContent(new ContentCommandService.CreateContent(
                contentId, "q-read-1", ContentKind.QUESTION, "Title", "en-US", "A1", "ONB"),
                editor(), key("create"), REQUEST);
        commands.createVersion(new ContentCommandService.CreateVersion(
                contentId, versionId, Map.of("prompt", "choose", "options", List.of("A", "B"),
                        "answerRule", Map.of("correctOption", "A")),
                publishableRights(), "note"), editor(), key("createVer"), REQUEST);
        commands.submitForReview(new ContentCommandService.VersionCommand(contentId, versionId), editor(), key("submit"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, versionId, ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, null, null),
                reviewerL1(), key("r1"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, versionId, ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, null, null),
                reviewerL2(), key("r2"), REQUEST);
        commands.publish(new ContentCommandService.VersionCommand(contentId, versionId), publisher(), key("publish"), REQUEST);
    }

    @Test
    @DisplayName("unpublished content is not readable by the public")
    void unpublishedNotReadable() {
        ContentCommandService commands = commands();
        commands.createContent(new ContentCommandService.CreateContent(
                contentId, "q-read-1", ContentKind.QUESTION, "Title", "en-US", "A1", "ONB"),
                editor(), key("create"), REQUEST);
        commands.createVersion(new ContentCommandService.CreateVersion(
                contentId, versionId, Map.of("prompt", "choose", "answerRule", Map.of("correctOption", "A")),
                publishableRights(), "note"), editor(), key("createVer"), REQUEST);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> reads.read(ContentReadRequest.publicContent(contentId)));
        assertEquals("CONTENT_NOT_PUBLISHED", ex.code());
    }

    @Test
    @DisplayName("published content is readable and never leaks answer rules")
    void publishedReadableWithoutAnswerLeak() {
        publishQuestion();
        PublicContentProjection projection = reads.read(ContentReadRequest.publicContent(contentId));
        assertEquals(contentId, projection.contentId());
        assertFalse(projection.fields().containsKey("answerRule"));
        assertTrue(projection.fields().containsKey("prompt"));
    }

    @Test
    @DisplayName("assessment snapshot requires an authorized service actor")
    void assessmentRequiresServiceActor() {
        publishQuestion();
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> reads.readAssessment(contentId, versionId, learner()));
        assertEquals("ANSWER_RULE_READ_FORBIDDEN", ex.code());

        AssessmentContentSnapshot snapshot = reads.readAssessment(contentId, versionId, serviceActor());
        assertTrue(snapshot.answerRules().containsKey("correctOption"));
    }

    @Test
    @DisplayName("admin preview requires a tenant-scoped editor")
    void adminPreviewRequiresEditor() {
        publishQuestion();
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> reads.preview(contentId, versionId, learner()));
        assertEquals("CONTENT_PREVIEW_FORBIDDEN", ex.code());

        var snapshot = reads.preview(contentId, versionId, editor());
        assertEquals(versionId, snapshot.versionId());
    }

    @Test
    @DisplayName("a learner can pin a previously published version after unpublish")
    void learnerPinnedPreviouslyPublished() {
        publishQuestion();
        ContentCommandService commands = commands();
        commands.unpublish(new ContentCommandService.VersionCommand(contentId, versionId), publisher(), key("unpublish"), REQUEST);

        ContentOperationException publicRead = assertThrows(ContentOperationException.class,
                () -> reads.read(ContentReadRequest.publicContent(contentId)));
        assertEquals("CONTENT_NOT_PUBLISHED", publicRead.code());

        PublicContentProjection pinned = reads.read(ContentReadRequest.learnerContent(
                contentId, versionId, true, learner()));
        assertEquals(versionId, pinned.versionId());
    }

    @Test
    @DisplayName("readByCode rejects a different tenant scope")
    void readByCodeTenantDenied() {
        publishQuestion();
        ContentActor otherTenant = new ContentActor("learner-x", "other-tenant", Set.of(), Set.of(), false);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> reads.readByCode("q-read-1", ContentAudience.LEARNER, ContentChannel.LEARNER,
                        versionId, false, otherTenant));
        assertEquals("CONTENT_TENANT_DENIED", ex.code());
    }

    @Test
    @DisplayName("readByCode returns the public projection for the matching tenant")
    void readByCodeMatches() {
        publishQuestion();
        PublicContentProjection projection = reads.readByCode(
                "q-read-1", ContentAudience.PUBLIC, ContentChannel.PUBLIC, null, false, null);
        assertEquals(contentId, projection.contentId());
        assertFalse(projection.fields().containsKey("answerRule"));
    }

    @Test
    @DisplayName("catalog only exposes currently published content")
    void catalogExposesPublished() {
        publishQuestion();
        List<PublicContentProjection> catalog = reads.catalog(
                ContentAudience.PUBLIC, ContentChannel.PUBLIC, null, null, null, null);
        assertEquals(1, catalog.size());
        assertEquals(contentId, catalog.get(0).contentId());

        List<PublicContentProjection> empty = reads.catalog(
                ContentAudience.PUBLIC, ContentChannel.PUBLIC, null, "NONEXISTENT", null, null);
        assertTrue(empty.isEmpty());
    }

    @Test
    @DisplayName("a poisoned projection cache cannot leak answer rules")
    void poisonedProjectionCacheDefense() {
        publishQuestion();
        // Inject a projection that incorrectly contains an answer rule.
        PublicContentProjection poisoned = new PublicContentProjection(
                contentId, versionId, ContentKind.QUESTION, "Title", "en-US", "A1", "ONB",
                ContentAudience.PUBLIC, Map.of("answerRule", Map.of("correctOption", "A")), "hash", NOW);
        projections.put(poisoned);
        PublicContentProjection safe = reads.read(ContentReadRequest.publicContent(contentId));
        assertFalse(safe.fields().containsKey("answerRule"));
    }

    @Test
    @DisplayName("learner catalog requires a verified principal")
    void learnerCatalogRequiresPrincipal() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> reads.catalog(ContentAudience.LEARNER, ContentChannel.LEARNER, null, null, null, null));
        assertEquals("CONTENT_PRINCIPAL_REQUIRED", ex.code());
    }
}
