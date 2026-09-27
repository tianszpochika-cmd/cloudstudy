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
    private ContentRights rights;
    private RightsProposal proposal;
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
            RightsProposal proposal,
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
        this.proposal = proposal == null ? RightsProposal.empty() : proposal;
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
        return new ContentVersion(versionId, versionNumber, kind, payload, rights,
                RightsProposal.empty(), editor, releaseNote, createdAt);
    }

    public static ContentVersion draft(
            ContentVersionId versionId,
            int versionNumber,
            ContentKind kind,
            ContentPayload payload,
            ContentRights rights,
            RightsProposal proposal,
            String editor,
            String releaseNote,
            Instant createdAt) {
        return new ContentVersion(versionId, versionNumber, kind, payload, rights, proposal,
                editor, releaseNote, createdAt);
    }

    /**
     * Rebuilds an immutable version fact from the content-service-owned store.
     *
     * <p>This is deliberately separate from {@link #draft}; adapters must not recreate a stored
     * version by replaying commands because that would change review and publication history.</p>
     */
    public static ContentVersion rehydrate(
            ContentVersionId versionId,
            int versionNumber,
            ContentKind kind,
            java.util.Map<String, Object> payload,
            String persistedHash,
            ContentRights rights,
            RightsProposal proposal,
            String editor,
            String releaseNote,
            Instant createdAt,
            ContentVersionStatus status,
            String firstReviewer,
            String finalReviewer,
            String publisher,
            Instant publishedAt,
            Instant archivedAt,
            ContentVersionId rollbackOfVersionId,
            int firstReviewVersion,
            int finalReviewVersion,
            long stateVersion) {
        if (status == null || stateVersion < 1 || firstReviewVersion < 0 || finalReviewVersion < 0) {
            throw ContentOperationException.unavailable(
                    "CONTENT_FACT_CORRUPT", "stored content version state is invalid");
        }
        ContentPayload validatedPayload = ContentSchemaValidator.validate(kind, payload);
        ContentVersion version = new ContentVersion(
                versionId, versionNumber, kind, validatedPayload, rights, proposal,
                editor, releaseNote, createdAt);
        if (persistedHash == null || !persistedHash.equals(version.contentHash)) {
            throw ContentOperationException.unavailable(
                    "CONTENT_FACT_CORRUPT", "stored content payload hash does not match its payload");
        }
        if (status == ContentVersionStatus.PUBLISHED && publishedAt == null) {
            throw ContentOperationException.unavailable(
                    "CONTENT_FACT_CORRUPT", "published content version has no publication time");
        }
        if (status == ContentVersionStatus.ARCHIVED && archivedAt == null) {
            throw ContentOperationException.unavailable(
                    "CONTENT_FACT_CORRUPT", "archived content version has no archive time");
        }
        version.status = status;
        version.firstReviewer = normalizeNullableActor(firstReviewer);
        version.finalReviewer = normalizeNullableActor(finalReviewer);
        version.publisher = normalizeNullableActor(publisher);
        version.publishedAt = publishedAt;
        version.archivedAt = archivedAt;
        version.rollbackOfVersionId = rollbackOfVersionId;
        version.firstReviewVersion = firstReviewVersion;
        version.finalReviewVersion = finalReviewVersion;
        version.stateVersion = stateVersion;
        return version;
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

    /**
     * L2 final-approval rights activation ("L2 终审自动 ACTIVE").
     *
     * <p>Flips a PENDING rights fact to ACTIVE only when the version-bound
     * editor proposal is complete and current; every activated term comes from
     * that proposal, so activation verifies but never invents. Returns false
     * (leaving PENDING) when the proposal is incomplete — the publish gate
     * then fails closed. Only the service calls this, immediately after
     * recording a FINAL APPROVED decision and re-verifying the bound
     * validation report.
     */
    public synchronized boolean activateRights(String reviewer, Instant now) {
        Objects.requireNonNull(now, "activation time is required");
        requireActor(reviewer, "reviewer");
        if (status != ContentVersionStatus.APPROVED
                || firstReviewer == null
                || finalReviewer == null
                || !finalReviewer.equals(reviewer)) {
            return false;
        }
        if (rights == null || rights.status() != CopyrightStatus.PENDING) {
            return rights != null && rights.status() == CopyrightStatus.ACTIVE;
        }
        java.util.Optional<ContentRights> verified = proposal.activatedCopy(
                rights.sourceCode(), rights.licenseCode(), now);
        if (verified.isEmpty()) {
            return false;
        }
        this.rights = verified.get();
        stateVersion++;
        return true;
    }

    public RightsProposal proposal() {
        return proposal;
    }

    /**
     * Rights view for validation and gating: the stored fact enriched with the
     * version-bound editor proposal. Validation checks the CLAIMED dossier
     * (still PENDING — it grants nothing); L2 activation verifies it. Without
     * a complete proposal the stored fact is checked as-is so gaps surface as
     * actionable findings.
     */
    public ContentRights effectiveRights() {
        ContentRights stored = rights().orElse(null);
        if (stored == null || !proposal.isComplete()) {
            return stored;
        }
        return new ContentRights(stored.sourceCode(), stored.licenseCode(), stored.status(),
                proposal.proposedAllowsLearning(),
                new java.util.LinkedHashSet<>(proposal.channelList()),
                null, null, proposal.proposedEvidenceRef());
    }

    public synchronized void publish(String publisherActor, Instant publishedAt) {
        requireActor(publisherActor, "publisher");
        requireStatus(ContentVersionStatus.APPROVED);
        requireDualApproval();
        requirePublishableRights(publishedAt);
        requireIndependentPublisher(publisherActor);
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
        requireIndependentPublisher(publisherActor);
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

    private void requireIndependentPublisher(String publisherActor) {
        requireActor(publisherActor, "publisher");
        if (publisherActor.equals(editor)
                || publisherActor.equals(firstReviewer)
                || publisherActor.equals(finalReviewer)) {
            throw ContentOperationException.conflict(
                    "FOUR_EYES_REQUIRED", "publisher must be distinct from editor and both reviewers");
        }
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

    private static String normalizeNullableActor(String actor) {
        if (actor == null) {
            return null;
        }
        return requireActor(actor, "stored actor");
    }
}
