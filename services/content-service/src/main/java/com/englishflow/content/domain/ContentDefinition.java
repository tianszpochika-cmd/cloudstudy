package com.englishflow.content.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

/** Stable content identity and its service-owned version pointer. */
public final class ContentDefinition {

    private final ContentId contentId;
    private final String tenantId;
    private final String contentCode;
    private final ContentKind kind;
    private final String title;
    private final String locale;
    private final String targetLevel;
    private final String goalCode;
    private final String createdBy;
    private final Instant createdAt;
    private final Map<ContentVersionId, ContentVersion> versions = new LinkedHashMap<>();

    private ContentVersionId currentPublishedVersionId;
    private long contentEpoch;
    private long projectionVersion;

    private static final Pattern CONTENT_CODE = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{1,127}");

    private ContentDefinition(
            ContentId contentId,
            String tenantId,
            String contentCode,
            ContentKind kind,
            String title,
            String locale,
            String targetLevel,
            String goalCode,
            String createdBy,
            Instant createdAt) {
        this.contentId = Objects.requireNonNull(contentId, "content id is required");
        this.tenantId = requireText(tenantId, "tenantId");
        this.contentCode = requireCode(contentCode, "contentCode");
        this.kind = Objects.requireNonNull(kind, "content kind is required");
        this.title = requireText(title, "title");
        this.locale = requireText(locale, "locale");
        this.targetLevel = requireText(targetLevel, "targetLevel");
        this.goalCode = requireText(goalCode, "goalCode");
        this.createdBy = requireText(createdBy, "createdBy");
        this.createdAt = Objects.requireNonNull(createdAt, "created time is required");
    }

    public static ContentDefinition create(
            ContentId contentId,
            String tenantId,
            String contentCode,
            ContentKind kind,
            String title,
            String locale,
            String targetLevel,
            String goalCode,
            String createdBy,
            Instant createdAt) {
        return new ContentDefinition(contentId, tenantId, contentCode, kind, title, locale,
                targetLevel, goalCode, createdBy, createdAt);
    }

    /** Rebuilds the aggregate without replaying commands or fabricating a new publication fact. */
    public static ContentDefinition rehydrate(
            ContentId contentId,
            String tenantId,
            String contentCode,
            ContentKind kind,
            String title,
            String locale,
            String targetLevel,
            String goalCode,
            String createdBy,
            Instant createdAt,
            List<ContentVersion> storedVersions,
            ContentVersionId currentPublishedVersionId,
            long contentEpoch,
            long projectionVersion) {
        if (contentEpoch < 0 || projectionVersion < 0 || storedVersions == null) {
            throw ContentOperationException.unavailable(
                    "CONTENT_FACT_CORRUPT", "stored content definition state is invalid");
        }
        ContentDefinition content = new ContentDefinition(
                contentId, tenantId, contentCode, kind, title, locale, targetLevel, goalCode,
                createdBy, createdAt);
        for (ContentVersion version : storedVersions) {
            if (version == null || version.kind() != kind || content.versions.containsKey(version.versionId())) {
                throw ContentOperationException.unavailable(
                        "CONTENT_FACT_CORRUPT", "stored content version does not belong to its content");
            }
            content.versions.put(version.versionId(), version);
        }
        if (currentPublishedVersionId != null) {
            ContentVersion current = content.versions.get(currentPublishedVersionId);
            if (current == null || current.status() != ContentVersionStatus.PUBLISHED) {
                throw ContentOperationException.unavailable(
                        "CONTENT_FACT_CORRUPT", "published pointer does not reference a published version");
            }
        }
        content.currentPublishedVersionId = currentPublishedVersionId;
        content.contentEpoch = contentEpoch;
        content.projectionVersion = projectionVersion;
        return content;
    }

    public synchronized ContentVersion addDraft(
            ContentVersionId versionId,
            Map<String, Object> payload,
            ContentRights rights,
            String editor,
            String releaseNote,
            Instant createdAt) {
        ContentPayload validated = ContentSchemaValidator.validate(kind, payload);
        int nextNumber = versions.values().stream()
                .mapToInt(ContentVersion::versionNumber)
                .max()
                .orElse(0) + 1;
        ContentVersion version = ContentVersion.draft(
                versionId, nextNumber, kind, validated, rights, editor, releaseNote, createdAt);
        versions.put(versionId, version);
        return version;
    }

    public synchronized void setPublished(ContentVersion version) {
        requireKnownVersion(version);
        if (version.status() != ContentVersionStatus.PUBLISHED) {
            throw ContentOperationException.conflict(
                    "CONTENT_POINTER_INVALID", "published pointer must reference a published version");
        }
        currentPublishedVersionId = version.versionId();
    }

    public synchronized void clearPublished(ContentVersion version) {
        requireKnownVersion(version);
        if (!version.versionId().equals(currentPublishedVersionId)) {
            throw ContentOperationException.conflict(
                    "CONTENT_POINTER_CONFLICT", "only the current published version can be unpublished");
        }
        currentPublishedVersionId = null;
    }

    public synchronized Optional<ContentVersion> currentPublishedVersion() {
        return Optional.ofNullable(currentPublishedVersionId).map(versions::get);
    }

    public synchronized Optional<ContentVersion> version(ContentVersionId versionId) {
        return Optional.ofNullable(versions.get(versionId));
    }

    public synchronized List<ContentVersion> versions() {
        return Collections.unmodifiableList(new ArrayList<>(versions.values()));
    }

    public ContentId contentId() {
        return contentId;
    }

    public String tenantId() {
        return tenantId;
    }

    public String contentCode() {
        return contentCode;
    }

    public ContentKind kind() {
        return kind;
    }

    public String title() {
        return title;
    }

    public String locale() {
        return locale;
    }

    public String targetLevel() {
        return targetLevel;
    }

    public String goalCode() {
        return goalCode;
    }

    public String createdBy() {
        return createdBy;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public synchronized Optional<ContentVersionId> currentPublishedVersionId() {
        return Optional.ofNullable(currentPublishedVersionId);
    }

    /** Advances the service-owned revision used by public projection and cache events. */
    public synchronized ProjectionRevision advanceProjectionRevision() {
        contentEpoch++;
        projectionVersion++;
        return new ProjectionRevision(projectionVersion, contentEpoch);
    }

    public synchronized long contentEpoch() {
        return contentEpoch;
    }

    public synchronized long projectionVersion() {
        return projectionVersion;
    }

    private void requireKnownVersion(ContentVersion version) {
        if (version == null || versions.get(version.versionId()) != version) {
            throw ContentOperationException.conflict(
                    "CONTENT_VERSION_NOT_OWNED", "version does not belong to this content definition");
        }
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 255) {
            throw ContentOperationException.badRequest("CONTENT_FIELD_INVALID", field + " is required");
        }
        return value.trim();
    }

    private static String requireCode(String value, String field) {
        if (value == null || !CONTENT_CODE.matcher(value).matches()) {
            throw ContentOperationException.badRequest("CONTENT_FIELD_INVALID", field + " has an invalid code");
        }
        return value;
    }

    public record ProjectionRevision(long projectionVersion, long contentEpoch) {

        public ProjectionRevision {
            if (projectionVersion < 1 || contentEpoch < 1) {
                throw new IllegalArgumentException("projection revision must be positive");
            }
        }
    }
}
