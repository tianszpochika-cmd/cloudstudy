package com.englishflow.content.application;

import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentDefinitionSnapshot;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentOutboxEvent;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.ContentVersionSnapshot;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.ContentProjectionPolicy;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;
import com.englishflow.content.port.ContentCacheInvalidator;
import com.englishflow.content.port.ContentIdempotencyPort;
import com.englishflow.content.port.ContentOutboxPort;
import com.englishflow.content.port.ContentRepository;
import com.englishflow.content.port.PublicProjectionStore;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * Content facts are changed only through commands owned by this service.
 *
 * <p>Admin/frontend BFFs may call an adapter around these commands, but they cannot write the
 * repository or projection directly. The JDBC composition root executes the fact, idempotency,
 * projection, cache-invalidation and {@link ContentOutboxPort#appendAfterFact(ContentOutboxEvent)}
 * writes in one content-owned local transaction; memory adapters remain test-only doubles.</p>
 */
public final class ContentCommandService {

    private final ContentRepository repository;
    private final ContentOutboxPort outbox;
    private final ContentIdempotencyPort idempotency;
    private final PublicProjectionStore projectionStore;
    private final ContentCacheInvalidator cacheInvalidator;
    private final Clock clock;

    public ContentCommandService(
            ContentRepository repository,
            ContentOutboxPort outbox,
            ContentIdempotencyPort idempotency,
            PublicProjectionStore projectionStore,
            ContentCacheInvalidator cacheInvalidator,
            Clock clock) {
        this.repository = Objects.requireNonNull(repository, "repository is required");
        this.outbox = Objects.requireNonNull(outbox, "outbox is required");
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency port is required");
        this.projectionStore = Objects.requireNonNull(projectionStore, "projection store is required");
        this.cacheInvalidator = Objects.requireNonNull(cacheInvalidator, "cache invalidator is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public ContentDefinitionSnapshot createContent(
            CreateContent command,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requireEditor(actor);
        Objects.requireNonNull(command, "create content command is required");
        Objects.requireNonNull(context, "request context is required");
        return idempotency.execute(
                scope(actor, "content.create"), key, fingerprint(command),
                () -> {
                    ContentDefinition content = ContentDefinition.create(
                            command.contentId(), actor.tenantId(), command.contentCode(), command.kind(),
                            command.title(), command.locale(), command.targetLevel(), command.goalCode(),
                            actor.subjectId(), clock.instant());
                    repository.create(content);
                    return ContentDefinitionSnapshot.from(content);
                });
    }

    public ContentVersionSnapshot createVersion(
            CreateVersion command,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requireEditor(actor);
        Objects.requireNonNull(command, "create version command is required");
        Objects.requireNonNull(context, "request context is required");
        ContentDefinition content = ownedContent(command.contentId(), actor);
        return idempotency.execute(
                scope(actor, "content.version.create"), key, fingerprint(command),
                () -> {
                    ContentVersion version = content.addDraft(
                            command.versionId(), command.payload(), command.rights(), actor.subjectId(),
                            command.releaseNote(), clock.instant());
                    repository.save(content);
                    return ContentVersionSnapshot.from(content.contentId(), version);
                });
    }

    public ContentVersionSnapshot submitForReview(
            VersionCommand command,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requireEditor(actor);
        Objects.requireNonNull(command, "version command is required");
        ContentDefinition content = ownedContent(command.contentId(), actor);
        return idempotency.execute(
                scope(actor, "content.submit"), key, fingerprint(command),
                () -> {
                    ContentVersion version = ownedVersion(content, command.versionId());
                    Instant submittedAt = clock.instant();
                    version.submitForReview(actor.subjectId());
                    repository.save(content);
                    appendVersion(content, version, "content.version.submitted.v1",
                            version.versionId().value() + ":submitted", 
                            ContentEventPayloads.versionSubmitted(content, version, submittedAt),
                            actor.subjectId(), context);
                    return ContentVersionSnapshot.from(content.contentId(), version);
                });
    }

    public ContentVersionSnapshot review(
            ReviewCommand command,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        Objects.requireNonNull(command, "review command is required");
        if (command.stage() == ReviewStage.FIRST_REVIEW && !actor.canReviewFirst()) {
            throw ContentOperationException.forbidden("CONTENT_REVIEW_L1_REQUIRED", "first review permission is required");
        }
        if (command.stage() == ReviewStage.FINAL_REVIEW && !actor.canReviewFinal()) {
            throw ContentOperationException.forbidden("CONTENT_REVIEW_L2_REQUIRED", "final review permission is required");
        }
        ContentDefinition content = ownedContent(command.contentId(), actor);
        return idempotency.execute(
                scope(actor, "content.review"), key, fingerprint(command),
                () -> {
                    ContentVersion version = ownedVersion(content, command.versionId());
                    Instant reviewedAt = clock.instant();
                    version.review(command.stage(), command.decision(), actor.subjectId(), reviewedAt);
                    repository.save(content);
                    appendVersion(content, version, "content.version.reviewed.v1",
                            version.versionId().value() + ":review:" + command.stage() + ":"
                                    + version.reviewVersion(command.stage()),
                            ContentEventPayloads.versionReviewed(
                                    content, version, command.stage(), command.decision(), reviewedAt),
                            actor.subjectId(), context);
                    return ContentVersionSnapshot.from(content.contentId(), version);
                });
    }

    public ContentVersionSnapshot publish(
            VersionCommand command,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requirePublisher(actor);
        Objects.requireNonNull(command, "publish command is required");
        ContentDefinition content = ownedContent(command.contentId(), actor);
        return idempotency.execute(
                scope(actor, "content.publish"), key, fingerprint(command),
                () -> {
                    ContentVersion version = ownedVersion(content, command.versionId());
                    Instant publishedAt = clock.instant();
                    version.publish(actor.subjectId(), publishedAt);
                    ContentVersion previous = content.currentPublishedVersion().orElse(null);
                    ContentDefinition.ProjectionRevision revision;
                    if (previous != null && !previous.versionId().equals(version.versionId())) {
                        previous.unpublish(actor.subjectId(), publishedAt);
                        projectionStore.remove(content.contentId(), previous.versionId());
                        cacheInvalidator.invalidate(content.contentId(), previous.versionId(), "superseded");
                    }
                    content.setPublished(version);
                    revision = content.advanceProjectionRevision();
                    repository.save(content);
                    rebuildProjections(content, version, publishedAt);
                    if (previous != null && !previous.versionId().equals(version.versionId())) {
                        appendVersion(content, previous, "content.version.unpublished.v1",
                                previous.versionId().value() + ":unpublished:superseded",
                                ContentEventPayloads.versionUnpublished(
                                        content, previous, revision, "SUPERSEDED", publishedAt),
                                actor.subjectId(), context);
                        appendProjectionInvalidated(content, previous, revision, "superseded", actor.subjectId(), context);
                    }
                    appendVersion(content, version, "content.version.published.v1",
                            version.versionId().value() + ":published:" + revision.projectionVersion(),
                            ContentEventPayloads.versionPublished(content, version, revision, publishedAt),
                            actor.subjectId(), context);
                    appendProjectionInvalidated(content, version, revision, "publish", actor.subjectId(), context);
                    return ContentVersionSnapshot.from(content.contentId(), version);
                });
    }

    public ContentVersionSnapshot unpublish(
            VersionCommand command,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requirePublisher(actor);
        Objects.requireNonNull(command, "unpublish command is required");
        ContentDefinition content = ownedContent(command.contentId(), actor);
        return idempotency.execute(
                scope(actor, "content.unpublish"), key, fingerprint(command),
                () -> {
                    ContentVersion version = ownedVersion(content, command.versionId());
                    if (content.currentPublishedVersionId().isEmpty()
                            || !content.currentPublishedVersionId().get().equals(version.versionId())) {
                        throw ContentOperationException.conflict(
                                "CONTENT_POINTER_CONFLICT", "only the current published version can be unpublished");
                    }
                    Instant unpublishedAt = clock.instant();
                    version.unpublish(actor.subjectId(), unpublishedAt);
                    content.clearPublished(version);
                    ContentDefinition.ProjectionRevision revision = content.advanceProjectionRevision();
                    repository.save(content);
                    projectionStore.remove(content.contentId(), version.versionId());
                    cacheInvalidator.invalidate(content.contentId(), version.versionId(), "unpublish");
                    appendVersion(content, version, "content.version.unpublished.v1",
                            version.versionId().value() + ":unpublished:explicit",
                            ContentEventPayloads.versionUnpublished(
                                    content, version, revision, "EXPLICIT_UNPUBLISH", unpublishedAt),
                            actor.subjectId(), context);
                    appendProjectionInvalidated(content, version, revision, "unpublish", actor.subjectId(), context);
                    return ContentVersionSnapshot.from(content.contentId(), version);
                });
    }

    public ContentVersionSnapshot rollback(
            RollbackCommand command,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requirePublisher(actor);
        Objects.requireNonNull(command, "rollback command is required");
        ContentDefinition content = ownedContent(command.contentId(), actor);
        return idempotency.execute(
                scope(actor, "content.rollback"), key, fingerprint(command),
                () -> {
                    ContentVersion current = content.currentPublishedVersion()
                            .orElseThrow(() -> ContentOperationException.conflict(
                                    "ROLLBACK_SOURCE_MISSING", "there is no current published version to roll back"));
                    ContentVersion target = ownedVersion(content, command.targetVersionId());
                    if (current.versionId().equals(target.versionId())) {
                        throw ContentOperationException.conflict(
                                "ROLLBACK_TARGET_INVALID", "rollback target is already current");
                    }
                    Instant now = clock.instant();
                    target.publishRollback(current.versionId(), actor.subjectId(), now);
                    current.unpublish(actor.subjectId(), now);
                    content.setPublished(target);
                    ContentDefinition.ProjectionRevision revision = content.advanceProjectionRevision();
                    repository.save(content);
                    projectionStore.remove(content.contentId(), current.versionId());
                    rebuildProjections(content, target, now);
                    cacheInvalidator.invalidate(content.contentId(), current.versionId(), "rollback-source");
                    appendVersion(content, target, "content.version.rolled_back.v1",
                            target.versionId().value() + ":rolled-back:" + revision.projectionVersion(),
                            ContentEventPayloads.versionRolledBack(
                                    content, current, target, revision, now),
                            actor.subjectId(), context);
                    appendProjectionInvalidated(content, target, revision, "rollback", actor.subjectId(), context);
                    return ContentVersionSnapshot.from(content.contentId(), target);
                });
    }

    /**
     * M3-006 projection rebuild (M2-004 reassignment): owner DB is the fact source;
     * public/learner projections (including any Redis/cache copy) are rebuilt from it.
     * Rights-gated: versions whose rights are not ready are skipped, never forced.
     */
    public RebuildReport rebuildPublishedProjections(ContentActor actor) {
        Objects.requireNonNull(actor, "actor is required");
        Instant now = clock.instant();
        int rebuilt = 0;
        int skipped = 0;
        for (com.englishflow.content.domain.ContentDefinition content : repository.findAll()) {
            if (!"platform".equals(content.tenantId())) {
                continue;
            }
            com.englishflow.content.domain.ContentVersion current =
                    content.currentPublishedVersion().orElse(null);
            if (current == null) {
                skipped++;
                continue;
            }
            try {
                rebuildProjections(content, current, now);
                rebuilt++;
            } catch (ContentOperationException notReady) {
                skipped++;
            }
        }
        return new RebuildReport(rebuilt, skipped, now);
    }

    public record RebuildReport(int rebuilt, int skipped, Instant rebuiltAt) {
    }

    private void rebuildProjections(ContentDefinition content, ContentVersion version, Instant now) {        projectionStore.put(ContentProjectionPolicy.project(
                content, version, ContentAudience.PUBLIC,
                com.englishflow.content.domain.ContentChannel.PUBLIC, now, false));
        projectionStore.put(ContentProjectionPolicy.project(
                content, version, ContentAudience.LEARNER,
                com.englishflow.content.domain.ContentChannel.LEARNER, now, false));
        cacheInvalidator.invalidate(content.contentId(), version.versionId(), "publish");
    }

    private void appendVersion(
            ContentDefinition content,
            ContentVersion version,
            String eventType,
            String operationKey,
            String payload,
            String actorId,
            ContentRequestContext context) {
        append("content_version", Long.toString(version.versionId().value()), eventType,
                operationKey, payload, actorId, context);
    }

    private void appendProjectionInvalidated(
            ContentDefinition content,
            ContentVersion version,
            ContentDefinition.ProjectionRevision revision,
            String reasonCode,
            String actorId,
            ContentRequestContext context) {
        append("content_public_projection", ContentEventPayloads.projectionKey(content),
                "content.public_projection.invalidated.v1",
                version.versionId().value() + ":projection-invalidated:" + revision.projectionVersion(),
                ContentEventPayloads.projectionInvalidated(
                        content, version, revision, reasonCode, clock.instant()), actorId, context);
    }

    private void append(
            String aggregateType,
            String aggregateId,
            String eventType,
            String operationKey,
            String payload,
            String actorId,
            ContentRequestContext context) {
        outbox.appendAfterFact(ContentOutboxEvent.create(
                aggregateType, aggregateId, eventType,
                actorId,
                // A version participates in several lifecycle facts (draft, review, publish,
                // unpublish and rollback). The event type is part of the durable dedupe scope;
                // otherwise a legitimate state transition reuses the draft key and is rejected
                // as a cross-event collision by the outbox adapter.
                aggregateType + ":" + aggregateId + ":" + eventType + ":" + operationKey,
                payload, context, clock.instant()));
    }

    private ContentDefinition ownedContent(ContentId contentId, ContentActor actor) {
        ContentDefinition content = repository.find(contentId).orElseThrow(() ->
                ContentOperationException.notFound("CONTENT_NOT_FOUND", "content does not exist"));
        if (!content.tenantId().equals(actor.tenantId())) {
            throw ContentOperationException.forbidden("CONTENT_TENANT_DENIED", "content tenant scope denied");
        }
        return content;
    }

    private static ContentVersion ownedVersion(ContentDefinition content, ContentVersionId versionId) {
        return content.version(versionId).orElseThrow(() ->
                ContentOperationException.notFound("CONTENT_VERSION_NOT_FOUND", "content version does not exist"));
    }

    private static void requireEditor(ContentActor actor) {
        if (actor == null || !actor.canEdit()) {
            throw ContentOperationException.forbidden("CONTENT_EDITOR_REQUIRED", "content editor permission is required");
        }
    }

    private static void requirePublisher(ContentActor actor) {
        if (actor == null || !actor.canPublish()) {
            throw ContentOperationException.forbidden("CONTENT_PUBLISHER_REQUIRED", "content publisher permission is required");
        }
    }

    private static String scope(ContentActor actor, String operation) {
        return actor.tenantId() + ":" + actor.subjectId() + ":" + operation;
    }

    private static String fingerprint(Object command) {
        return ContentPayloadHash.sha256(Map.of("command", command.toString()));
    }

    public record CreateContent(
            ContentId contentId,
            String contentCode,
            ContentKind kind,
            String title,
            String locale,
            String targetLevel,
            String goalCode) {
    }

    public record CreateVersion(
            ContentId contentId,
            ContentVersionId versionId,
            Map<String, Object> payload,
            ContentRights rights,
            String releaseNote) {
    }

    public record VersionCommand(ContentId contentId, ContentVersionId versionId) {
    }

    public record ReviewCommand(
            ContentId contentId,
            ContentVersionId versionId,
            ReviewStage stage,
            ReviewDecision decision,
            String reasonCode,
            String note) {
    }

    public record RollbackCommand(ContentId contentId, ContentVersionId targetVersionId) {
    }
}
