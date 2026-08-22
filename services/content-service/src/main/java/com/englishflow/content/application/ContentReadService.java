package com.englishflow.content.application;

import com.englishflow.content.domain.AssessmentContentSnapshot;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentChannel;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentProjectionPolicy;
import com.englishflow.content.domain.ContentReadRequest;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.ContentVersionSnapshot;
import com.englishflow.content.domain.PublicContentProjection;
import com.englishflow.content.port.ContentRepository;
import com.englishflow.content.port.PublicProjectionStore;

import java.time.Clock;
import java.util.Objects;

/**
 * Read-only content boundary for public, learner and trusted assessment consumers.
 *
 * <p>Drafts are never resolved for public/learner reads. A learner may explicitly resume a
 * previously published pinned version after unpublish; public readers cannot use that escape
 * hatch. The assessment path is the only path that returns answer rules.</p>
 */
public final class ContentReadService {

    private final ContentRepository repository;
    private final PublicProjectionStore projectionStore;
    private final Clock clock;

    public ContentReadService(
            ContentRepository repository,
            PublicProjectionStore projectionStore,
            Clock clock) {
        this.repository = Objects.requireNonNull(repository, "repository is required");
        this.projectionStore = Objects.requireNonNull(projectionStore, "projection store is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public PublicContentProjection read(ContentReadRequest request) {
        Objects.requireNonNull(request, "content read request is required");
        ContentDefinition content = findContent(request.contentId());
        ContentVersion version = resolveVersion(content, request.pinnedVersionId().orElse(null), request.audience());
        if (request.audience() == ContentAudience.ADMIN_PREVIEW) {
            requireAdminPreview(request.actor(), content);
        }
        if (request.audience() == ContentAudience.PUBLIC || request.audience() == ContentAudience.LEARNER) {
            return projectionStore.find(content.contentId(), version.versionId(), request.audience())
                    .filter(projection -> projection.versionId().equals(version.versionId()))
                    .orElseGet(() -> ContentProjectionPolicy.project(
                            content, version, request.audience(), request.channel(), clock.instant(),
                            request.allowPreviouslyPublishedPin()));
        }
        if (request.audience() == ContentAudience.ASSESSMENT) {
            throw ContentOperationException.forbidden(
                    "ANSWER_RULE_PROJECTION_FORBIDDEN", "use the assessment snapshot port for answer rules");
        }
        return ContentProjectionPolicy.project(
                content, version, ContentAudience.ADMIN_PREVIEW, ContentChannel.ADMIN, clock.instant(), false);
    }

    public AssessmentContentSnapshot readAssessment(
            ContentId contentId,
            ContentVersionId pinnedVersionId,
            ContentActor serviceActor) {
        if (serviceActor == null || !serviceActor.canReadAnswerRules()) {
            throw ContentOperationException.forbidden(
                    "ANSWER_RULE_READ_FORBIDDEN", "only an authorized assessment service may read answer rules");
        }
        ContentDefinition content = findContent(contentId);
        ContentVersion version = resolveVersion(content, pinnedVersionId, ContentAudience.ASSESSMENT);
        return ContentProjectionPolicy.assessmentSnapshot(content, version, ContentChannel.ASSESSMENT, clock.instant());
    }

    public ContentVersionSnapshot preview(
            ContentId contentId,
            ContentVersionId versionId,
            ContentActor actor) {
        ContentDefinition content = findContent(contentId);
        requireAdminPreview(actor, content);
        ContentVersion version = resolveVersion(content, versionId, ContentAudience.ADMIN_PREVIEW);
        return ContentVersionSnapshot.from(contentId, version);
    }

    private ContentDefinition findContent(ContentId contentId) {
        return repository.find(contentId).orElseThrow(() ->
                ContentOperationException.notFound("CONTENT_NOT_FOUND", "content does not exist"));
    }

    private static ContentVersion resolveVersion(
            ContentDefinition content,
            ContentVersionId requestedVersionId,
            ContentAudience audience) {
        if (requestedVersionId == null) {
            return content.currentPublishedVersion().orElseThrow(() ->
                    ContentOperationException.notFound(
                            "CONTENT_NOT_PUBLISHED", "content has no currently published version"));
        }
        ContentVersion version = content.version(requestedVersionId).orElseThrow(() ->
                ContentOperationException.notFound("CONTENT_VERSION_NOT_FOUND", "content version does not exist"));
        if (audience != ContentAudience.ADMIN_PREVIEW
                && version.status() != com.englishflow.content.domain.ContentVersionStatus.PUBLISHED
                && !(audience == ContentAudience.LEARNER && version.wasPublished())) {
            throw ContentOperationException.notFound(
                    "CONTENT_VERSION_NOT_AVAILABLE", "requested content version is not available");
        }
        return version;
    }

    private static void requireAdminPreview(ContentActor actor, ContentDefinition content) {
        if (actor == null || !actor.canEdit() || !actor.tenantId().equals(content.tenantId())) {
            throw ContentOperationException.forbidden(
                    "CONTENT_PREVIEW_FORBIDDEN", "content preview requires a tenant-scoped editor");
        }
    }
}
