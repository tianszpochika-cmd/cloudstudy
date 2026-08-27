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
import java.util.List;
import java.util.Objects;
import java.util.Optional;

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
        ContentVersion version = resolveVersion(content, request.pinnedVersionId().orElse(null), request.audience(),
                request.allowPreviouslyPublishedPin());
        if (request.audience() == ContentAudience.ADMIN_PREVIEW) {
            requireAdminPreview(request.actor(), content);
        }
        if (request.audience() == ContentAudience.PUBLIC || request.audience() == ContentAudience.LEARNER) {
            // Always evaluate publication and rights against the current fact first. A stale
            // cache/projection row must never turn an archived or rights-expired version back
            // into readable content.
            PublicContentProjection safeProjection = ContentProjectionPolicy.project(
                    content, version, request.audience(), request.channel(), clock.instant(),
                    request.allowPreviouslyPublishedPin());
            return projectionStore.find(content.contentId(), version.versionId(), request.audience())
                    .filter(projection -> projection.versionId().equals(version.versionId()))
                    .filter(projection -> !projection.containsAnswerRules())
                    .orElse(safeProjection);
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
        ContentVersion version = resolveVersion(content, pinnedVersionId, ContentAudience.ASSESSMENT, false);
        return ContentProjectionPolicy.assessmentSnapshot(content, version, ContentChannel.ASSESSMENT, clock.instant());
    }

    public ContentVersionSnapshot preview(
            ContentId contentId,
            ContentVersionId versionId,
            ContentActor actor) {
        ContentDefinition content = findContent(contentId);
        requireAdminPreview(actor, content);
        ContentVersion version = resolveVersion(content, versionId, ContentAudience.ADMIN_PREVIEW, false);
        return ContentVersionSnapshot.from(contentId, version);
    }

    public PublicContentProjection readByCode(
            String contentCode,
            ContentAudience audience,
            ContentChannel channel,
            ContentVersionId pinnedVersionId,
            boolean allowPreviouslyPublishedPin,
            ContentActor actor) {
        return readByCodeResult(contentCode, audience, channel, pinnedVersionId,
                allowPreviouslyPublishedPin, actor).projection();
    }

    public ReadResult readByCodeResult(
            String contentCode,
            ContentAudience audience,
            ContentChannel channel,
            ContentVersionId pinnedVersionId,
            boolean allowPreviouslyPublishedPin,
            ContentActor actor) {
        ContentDefinition content = repository.findByCode(contentCode).orElseThrow(() ->
                ContentOperationException.notFound("CONTENT_NOT_FOUND", "content does not exist"));
        if (audience == ContentAudience.LEARNER && actor == null) {
            throw ContentOperationException.forbidden(
                    "CONTENT_PRINCIPAL_REQUIRED", "learner content requires a verified principal");
        }
        if (actor != null && !actor.tenantId().equals(content.tenantId())) {
            throw ContentOperationException.forbidden("CONTENT_TENANT_DENIED", "content tenant scope denied");
        }
        PublicContentProjection projection = read(new ContentReadRequest(
                content.contentId(), audience, channel, Optional.ofNullable(pinnedVersionId),
                allowPreviouslyPublishedPin, actor));
        ContentVersion version = resolveVersion(
                content, pinnedVersionId, audience, allowPreviouslyPublishedPin);
        return new ReadResult(content.contentCode(), version.versionNumber(), content.contentEpoch(),
                content.projectionVersion(), version.publishedAt().orElse(version.createdAt()), projection);
    }

    public List<PublicContentProjection> catalog(
            ContentAudience audience,
            ContentChannel channel,
            ContentActor actor,
            String locale,
            String targetLevel,
            String contentType) {
        return catalogEntries(audience, channel, actor, locale, targetLevel, contentType).stream()
                .map(CatalogEntry::projection)
                .toList();
    }

    public List<CatalogEntry> catalogEntries(
            ContentAudience audience,
            ContentChannel channel,
            ContentActor actor,
            String locale,
            String targetLevel,
            String contentType) {
        if (audience != ContentAudience.PUBLIC && audience != ContentAudience.LEARNER) {
            throw ContentOperationException.badRequest("CONTENT_AUDIENCE_INVALID", "catalog audience is invalid");
        }
        if (audience == ContentAudience.LEARNER && actor == null) {
            throw ContentOperationException.forbidden(
                    "CONTENT_PRINCIPAL_REQUIRED", "learner catalog requires a verified principal");
        }
        return repository.findAll().stream()
                .filter(content -> actor == null || actor.tenantId().equals(content.tenantId()))
                .filter(content -> locale == null || locale.isBlank() || content.locale().equals(locale))
                .filter(content -> targetLevel == null || targetLevel.isBlank()
                        || content.targetLevel().equals(targetLevel))
                .filter(content -> contentType == null || contentType.isBlank()
                        || content.kind().name().equals(contentType))
                .sorted(java.util.Comparator.comparing(ContentDefinition::contentCode))
                .flatMap(content -> content.currentPublishedVersion()
                        .map(version -> {
                            try {
                                return Optional.of(new CatalogEntry(
                                        content.contentCode(), version.versionNumber(), content.contentEpoch(),
                                        content.projectionVersion(), version.publishedAt().orElse(version.createdAt()),
                                        ContentProjectionPolicy.project(
                                                content, version, audience, channel, clock.instant(), false)));
                            } catch (ContentOperationException exception) {
                                if (exception.status() == 403 || exception.status() == 404) {
                                    return Optional.<CatalogEntry>empty();
                                }
                                throw exception;
                            }
                        }).orElseGet(Optional::empty).stream())
                .toList();
    }

    private ContentDefinition findContent(ContentId contentId) {
        return repository.find(contentId).orElseThrow(() ->
                ContentOperationException.notFound("CONTENT_NOT_FOUND", "content does not exist"));
    }

    private static ContentVersion resolveVersion(
            ContentDefinition content,
            ContentVersionId requestedVersionId,
            ContentAudience audience,
            boolean allowPreviouslyPublishedPin) {
        if (requestedVersionId == null) {
            return content.currentPublishedVersion().orElseThrow(() ->
                    ContentOperationException.notFound(
                            "CONTENT_NOT_PUBLISHED", "content has no currently published version"));
        }
        ContentVersion version = content.version(requestedVersionId).orElseThrow(() ->
                ContentOperationException.notFound("CONTENT_VERSION_NOT_FOUND", "content version does not exist"));
        if (audience != ContentAudience.ADMIN_PREVIEW
                && version.status() != com.englishflow.content.domain.ContentVersionStatus.PUBLISHED
                && !(audience == ContentAudience.LEARNER
                && allowPreviouslyPublishedPin && version.wasPublished())) {
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

    public record ReadResult(
            String contentCode,
            int versionNumber,
            long contentEpoch,
            long projectionVersion,
            java.time.Instant publishedAt,
            PublicContentProjection projection) {
    }

    public record CatalogEntry(
            String contentCode,
            int versionNumber,
            long contentEpoch,
            long projectionVersion,
            java.time.Instant publishedAt,
            PublicContentProjection projection) {
    }
}
