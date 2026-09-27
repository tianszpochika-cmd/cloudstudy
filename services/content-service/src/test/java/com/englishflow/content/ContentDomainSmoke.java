package com.englishflow.content;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.InMemoryValidationReportStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentReadService;
import com.englishflow.content.domain.AssessmentContentSnapshot;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentReadRequest;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.PublicContentProjection;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Dependency-free smoke test for the CNT-002/CNT-003 domain slice.
 *
 * <p>Run with Java 25 after Maven is available; the current workstation only has Java 24, so
 * the repository validation command compiles/runs this class with the installed runtime as a
 * syntax/domain check and does not claim a Java 25 build.</p>
 */
public final class ContentDomainSmoke {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final ContentRequestContext REQUEST = new ContentRequestContext(
            "req-b9-content-001", "0123456789abcdef0123456789abcdef");
    private static final ContentRights RIGHTS = new ContentRights(
            "source-b9", "license-b9", CopyrightStatus.ACTIVE, true,
            Set.of("PUBLIC", "LEARNER", "ASSESSMENT"), NOW.minusSeconds(60), null, "evidence-b9");

    public static void main(String[] args) {
        InMemoryContentRepository repository = new InMemoryContentRepository();
        InMemoryContentOutbox outbox = new InMemoryContentOutbox();
        InMemoryPublicProjectionStore projections = new InMemoryPublicProjectionStore();
        RecordingContentCacheInvalidator invalidator = new RecordingContentCacheInvalidator();
        ContentCommandService commands = new ContentCommandService(
                repository, outbox, new InMemoryContentIdempotency(), projections, invalidator,
                new InMemoryValidationReportStore(), Clock.fixed(NOW, ZoneOffset.UTC));
        ContentReadService reads = new ContentReadService(repository, projections, Clock.fixed(NOW, ZoneOffset.UTC));

        ContentActor editor = actor("editor-b9", "content-editor", "content:write");
        ContentActor firstReviewer = actor("reviewer-l1-b9", "review-l1");
        ContentActor finalReviewer = actor("reviewer-l2-b9", "review-l2");
        ContentActor publisher = actor("publisher-b9", "content-publisher");
        ContentActor assessment = new ContentActor(
                "assessment-service", "platform", Set.of(), Set.of("content:answer-rules:read"), true);

        ContentId contentId = new ContentId("cnt_b9_content_001");
        commands.createContent(new ContentCommandService.CreateContent(
                contentId, "b9-question-001", ContentKind.QUESTION, "B9 question", "en-US", "A1", "ONB"),
                editor, key("create-content-b9"), REQUEST);
        commands.createVersion(new ContentCommandService.CreateVersion(
                contentId, new ContentVersionId(1001L),
                Map.of("prompt", "Choose one", "options", List.of("A", "B"),
                        "answerRule", Map.of("correctOption", "A"), "summary", "public summary"),
                RIGHTS, "initial version"), editor, key("create-version-b9"), REQUEST);

        assertCode(() -> reads.read(ContentReadRequest.publicContent(contentId)), "CONTENT_NOT_PUBLISHED");
        commands.submitForReview(new ContentCommandService.VersionCommand(
                contentId, new ContentVersionId(1001L)), editor, key("submit-content-b9"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, new ContentVersionId(1001L), ReviewStage.FIRST_REVIEW,
                ReviewDecision.APPROVED, null, null), firstReviewer, key("review-first-b9"), REQUEST);
        commands.review(new ContentCommandService.ReviewCommand(
                contentId, new ContentVersionId(1001L), ReviewStage.FINAL_REVIEW,
                ReviewDecision.APPROVED, null, null), finalReviewer, key("review-final-b9"), REQUEST);

        ContentCommandService.VersionCommand publish = new ContentCommandService.VersionCommand(
                contentId, new ContentVersionId(1001L));
        commands.publish(publish, publisher, key("publish-content-b9"), REQUEST);
        commands.publish(publish, publisher, key("publish-content-b9"), REQUEST);
        assertEquals(1L, outbox.countByType("content.version.published.v1"), "idempotent publish emits one event");
        assertEquals(1L, outbox.countByType("content.public_projection.invalidated.v1"),
                "publish emits one projection invalidation");
        var publishedEvent = outbox.events().stream()
                .filter(event -> event.eventType().equals("content.version.published.v1"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("canonical published event is missing"));
        assertEquals("content_version", publishedEvent.aggregateType(), "published aggregate type");
        assertEquals("1001", publishedEvent.aggregateId(), "published aggregate id");
        assertEquals("content.event.v1", publishedEvent.schemaVersion(), "published event schema");
        assertEquals("1", Integer.toString(publishedEvent.version()), "published event version");
        if (!publishedEvent.payloadJson().contains("\"contentVersionId\":1001")) {
            throw new AssertionError("published event must carry numeric contentVersionId");
        }

        PublicContentProjection publicProjection = reads.read(ContentReadRequest.publicContent(contentId));
        if (publicProjection.containsAnswerRules()
                || publicProjection.fields().containsKey("answerRule")) {
            throw new AssertionError("answer rules leaked into public projection");
        }
        AssessmentContentSnapshot assessmentSnapshot = reads.readAssessment(
                contentId, new ContentVersionId(1001L), assessment);
        if (!assessmentSnapshot.answerRules().containsKey("correctOption")) {
            throw new AssertionError("assessment snapshot lost answer rules");
        }

        commands.unpublish(new ContentCommandService.VersionCommand(
                contentId, new ContentVersionId(1001L)), publisher,
                key("unpublish-content-b9"), REQUEST);
        assertCode(() -> reads.read(ContentReadRequest.publicContent(contentId)), "CONTENT_NOT_PUBLISHED");
        PublicContentProjection pinned = reads.read(ContentReadRequest.learnerContent(
                contentId, new ContentVersionId(1001L), true));
        if (!pinned.versionId().equals(new ContentVersionId(1001L))) {
            throw new AssertionError("learner version pin did not recover the previously published version");
        }
        if (invalidator.invalidations().size() < 2) {
            throw new AssertionError("publish/unpublish must invalidate projection cache");
        }
        System.out.println("content-service B9 smoke: PASS");
    }

    private static ContentActor actor(String subject, String role, String... permissions) {
        return new ContentActor(subject, "platform", Set.of(role), Set.of(permissions), false);
    }

    private static ContentIdempotencyKey key(String value) {
        return new ContentIdempotencyKey(value + "-key");
    }

    private static void assertCode(Runnable action, String code) {
        try {
            action.run();
            throw new AssertionError("expected " + code);
        } catch (ContentOperationException exception) {
            if (!code.equals(exception.code())) {
                throw new AssertionError("expected " + code + " but was " + exception.code(), exception);
            }
        }
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new AssertionError(message + ": expected " + expected + " but was " + actual);
        }
    }
}
