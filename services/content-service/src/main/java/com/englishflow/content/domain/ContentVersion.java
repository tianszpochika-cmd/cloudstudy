package com.englishflow.content.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Versioned content fact and its publication state machine.
 *
 * <p>Payload, rights and review facts belong to this version. Publication changes the aggregate
 * pointer; it never mutates a learner's already pinned content payload.</p>
 */
public final class ContentVersion {

    private final ContentVersionId versionId;
    private final int versionNumber;
    private final ContentKind kind;
    private final ContentPayload payload;
    private final String contentHash;
    private final ContentRights rights;
    private final String editor;
    private final Instant createdAt;
    private final String releaseNote;

    private ContentVersionStatus status = ContentVersionStatus.DRAFT;
    private String firstReviewer;
    private String finalReviewer;
    private String publisher;
    private Instant publishedAt;
    private Instant archivedAt;
    private ContentVersionId rollbackOfVersionId;
    private int firstReviewVersion;
    private int finalReviewVersion;
    private long stateVersion = 1;

    private ContentVersion(
            ContentVersionId versionId,
            int versionNumber,
            ContentKind kind,
            ContentPayload payload,
            ContentRights rights,
            String editor,
            String releaseNote,
            Instant createdAt) {
        if (versionNumber < 1) {
            throw ContentOperationException.badRequest("CONTENT_VERSION_NUMBER_INVALID", "version number must be positive");
        }
        this.versionId = Objects.requireNonNull(versionId, "version id is required");
        this.versionNumber = versionNumber;
        this.kind = Objects.requireNonNull(kind, "content kind is required");
        this.payload = Objects.requireNonNull(payload, "content payload is required");
        this.contentHash = ContentPayloadHash.sha256(payload.raw());
        this.rights = rights;
        this.editor = requireActor(editor, "editor");
        this.releaseNote = releaseNote == null ? "" : releaseNote.trim();
        this.createdAt = Objects.requireNonNull(createdAt, "created time is required");
    }

    public static ContentVersion draft(
            ContentVersionId versionId,
            int versionNumber,
            ContentKind kind,
            ContentPayload payload,
            ContentRights rights,
            String editor,
            String releaseNote,
            Instant createdAt) {
        return new ContentVersion(versionId, versionNumber, kind, payload, rights, editor, releaseNote, createdAt);
    }

    public synchronized void replaceDraft(
            ContentPayload replacement,
            ContentRights replacementRights,
            String replacementReleaseNote,
            String actor) {
        requireEditor(actor);
        requireStatus(ContentVersionStatus.DRAFT);
        throw ContentOperationException.conflict(
                "DRAFT_IMMUTABLE_AFTER_CREATION", "version facts are immutable; create a new draft version");
    }

    public synchronized void submitForReview(String actor) {
        requireEditor(actor);
        requireStatus(ContentVersionStatus.DRAFT);
        status = ContentVersionStatus.IN_REVIEW;
        stateVersion++;
    }

    public synchronized void review(
            ReviewStage stage,
            ReviewDecision decision,
            String reviewer,
            Instant decidedAt) {
        Objects.requireNonNull(stage, "review stage is required");
        Objects.requireNonNull(decision, "review decision is required");
        requireActor(reviewer, "reviewer");
        Objects.requireNonNull(decidedAt, "review time is required");
        if (reviewer.equals(editor)) {
            throw ContentOperationException.conflict(
                    "FOUR_EYES_REQUIRED", "content editor cannot review or approve the same version");
        }
        if (decision != ReviewDecision.APPROVED) {
            if (stage == ReviewStage.FIRST_REVIEW && status != ContentVersionStatus.IN_REVIEW) {
                throw invalidReviewState();
            }
            if (stage == ReviewStage.FINAL_REVIEW && status != ContentVersionStatus.APPROVED) {
                throw invalidReviewState();
            }
            incrementReviewVersion(stage);
            status = ContentVersionStatus.DRAFT;
            firstReviewer = null;
            finalReviewer = null;
            stateVersion++;
            return;
        }
        if (stage == ReviewStage.FIRST_REVIEW) {
            requireStatus(ContentVersionStatus.IN_REVIEW);
            incrementReviewVersion(stage);
            firstReviewer = reviewer;
            status = ContentVersionStatus.APPROVED;
            stateVersion++;
            return;
        }
        requireStatus(ContentVersionStatus.APPROVED);
        if (firstReviewer == null || firstReviewer.equals(reviewer)) {
            throw ContentOperationException.conflict(
                    "DUAL_REVIEW_REQUIRED", "first and final reviewers must be distinct");
        }
        incrementReviewVersion(stage);
        finalReviewer = reviewer;
        stateVersion++;
    }

    public synchronized void publish(String publisherActor, Instant publishedAt) {
        requireActor(publisherActor, "publisher");
        requireStatus(ContentVersionStatus.APPROVED);
        requireDualApproval();
        requirePublishableRights(publishedAt);
        if (publisherActor.equals(editor)) {
            throw ContentOperationException.conflict(
                    "FOUR_EYES_REQUIRED", "content editor cannot publish the same version");
        }
        this.publisher = publisherActor;
        this.publishedAt = Objects.requireNonNull(publishedAt, "publication time is required");
        this.archivedAt = null;
        this.status = ContentVersionStatus.PUBLISHED;
        stateVersion++;
    }

    public synchronized void unpublish(String actor, Instant archivedAt) {
        requireActor(actor, "unpublisher");
        requireStatus(ContentVersionStatus.PUBLISHED);
        this.archivedAt = Objects.requireNonNull(archivedAt, "unpublish time is required");
        this.status = ContentVersionStatus.ARCHIVED;
        stateVersion++;
    }

    public synchronized void publishRollback(
            ContentVersionId rolledBackFrom,
            String publisherActor,
            Instant publishedAt) {
        if (status != ContentVersionStatus.ARCHIVED && status != ContentVersionStatus.APPROVED) {
            throw ContentOperationException.conflict(
                    "ROLLBACK_TARGET_INVALID", "rollback target must be approved or previously published");
        }
        requireDualApproval();
        requirePublishableRights(publishedAt);
        if (publisherActor.equals(editor)) {
            throw ContentOperationException.conflict(
                    "FOUR_EYES_REQUIRED", "content editor cannot publish a rollback");
        }
        this.rollbackOfVersionId = Objects.requireNonNull(rolledBackFrom, "rolled back version is required");
        this.publisher = requireActor(publisherActor, "publisher");
        this.publishedAt = Objects.requireNonNull(publishedAt, "publication time is required");
        this.archivedAt = null;
        this.status = ContentVersionStatus.PUBLISHED;
        stateVersion++;
    }

    public synchronized boolean wasPublished() {
        return publishedAt != null;
    }

    public synchronized boolean hasDualApproval() {
        return firstReviewer != null
                && finalReviewer != null
                && !firstReviewer.equals(finalReviewer)
                && !firstReviewer.equals(editor)
                && !finalReviewer.equals(editor);
    }

    public ContentVersionId versionId() {
        return versionId;
    }

    public int versionNumber() {
        return versionNumber;
    }

    public ContentKind kind() {
        return kind;
    }

    public ContentPayload payload() {
        return payload;
    }

    public String contentHash() {
        return contentHash;
    }

    public Optional<ContentRights> rights() {
        return Optional.ofNullable(rights);
    }

    public String editor() {
        return editor;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public String releaseNote() {
        return releaseNote;
    }

    public synchronized ContentVersionStatus status() {
        return status;
    }

    public synchronized Optional<String> firstReviewer() {
        return Optional.ofNullable(firstReviewer);
    }

    public synchronized Optional<String> finalReviewer() {
        return Optional.ofNullable(finalReviewer);
    }

    public synchronized Optional<String> publisher() {
        return Optional.ofNullable(publisher);
    }

    public synchronized Optional<Instant> publishedAt() {
        return Optional.ofNullable(publishedAt);
    }

    public synchronized Optional<Instant> archivedAt() {
        return Optional.ofNullable(archivedAt);
    }

    public synchronized Optional<ContentVersionId> rollbackOfVersionId() {
        return Optional.ofNullable(rollbackOfVersionId);
    }

    public synchronized long stateVersion() {
        return stateVersion;
    }

    public synchronized int reviewVersion(ReviewStage stage) {
        return stage == ReviewStage.FIRST_REVIEW ? firstReviewVersion : finalReviewVersion;
    }

    private void incrementReviewVersion(ReviewStage stage) {
        if (stage == ReviewStage.FIRST_REVIEW) {
            firstReviewVersion++;
        } else {
            finalReviewVersion++;
        }
    }

    private void requirePublishableRights(Instant now) {
        if (rights == null
                || !rights.allows(ContentChannel.LEARNER, now)
                || !rights.allows(ContentChannel.PUBLIC, now)) {
            throw ContentOperationException.conflict(
                    "CONTENT_RIGHTS_NOT_READY",
                    "active learner and public copyright rights are required before publication");
        }
    }

    private void requireDualApproval() {
        if (!hasDualApproval()) {
            throw ContentOperationException.conflict(
                    "PUBLISH_REVIEW_REQUIRED", "distinct first and final review approvals are required");
        }
    }

    private void requireEditor(String actor) {
        if (!editor.equals(actor)) {
            throw ContentOperationException.forbidden("CONTENT_EDITOR_REQUIRED", "only the version editor may change this draft");
        }
    }

    private void requireStatus(ContentVersionStatus expected) {
        if (status != expected) {
            throw ContentOperationException.conflict(
                    "CONTENT_STATE_INVALID", "expected " + expected + " but was " + status);
        }
    }

    private static ContentOperationException invalidReviewState() {
        return ContentOperationException.conflict(
                "REVIEW_STATE_INVALID", "version is not awaiting the requested review stage");
    }

    private static String requireActor(String actor, String field) {
        if (actor == null || actor.isBlank() || actor.length() > 128) {
            throw ContentOperationException.badRequest("ACTOR_INVALID", field + " is required");
        }
        return actor.trim();
    }
}
