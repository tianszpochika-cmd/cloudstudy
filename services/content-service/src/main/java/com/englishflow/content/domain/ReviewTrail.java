package com.englishflow.content.domain;

import java.time.Instant;

/**
 * Review bookkeeping shared by row-level aggregates (lexeme, content item).
 *
 * <p>{@code submittedBy} is the account that sent the current draft to review;
 * it can never approve that submission (author/reviewer separation).
 * {@code lastDecision}/{@code lastNote} keep the latest reviewer verdict so the
 * author sees why a draft came back. {@code revisionOfLive} marks a DRAFT that
 * reworks an already-published row: learners keep the last published copy
 * until the revision is re-reviewed and republished.</p>
 */
public record ReviewTrail(
        String submittedBy,
        String lastDecision,
        String lastNote,
        String lastReviewer,
        Instant lastReviewedAt,
        boolean revisionOfLive) {

    public static final ReviewTrail EMPTY = new ReviewTrail(null, null, null, null, null, false);
    public static final int MAX_NOTE = 500;

    public ReviewTrail submitted(String author) {
        return new ReviewTrail(author, lastDecision, lastNote, lastReviewer, lastReviewedAt, revisionOfLive);
    }

    public ReviewTrail decided(String decision, String note, String reviewer, Instant at) {
        return new ReviewTrail(submittedBy, decision, note, reviewer, at, revisionOfLive);
    }

    public ReviewTrail revision(boolean live) {
        return new ReviewTrail(submittedBy, lastDecision, lastNote, lastReviewer, lastReviewedAt, live);
    }

    /** Throws when the reviewer is the account that submitted (or, for legacy rows, authored) the draft. */
    public void requireNotAuthor(String reviewer, String fallbackAuthor, String codePrefix) {
        String author = submittedBy != null ? submittedBy : fallbackAuthor;
        if (author != null && author.equals(reviewer)) {
            throw ContentOperationException.forbidden(codePrefix + "_SELF_APPROVAL_DENIED",
                    "the account that submitted this draft cannot review it; ask another reviewer");
        }
    }

    public static String requireRejectNote(String note, String codePrefix) {
        String value = note == null ? "" : note.trim();
        if (value.isEmpty()) {
            throw ContentOperationException.badRequest(codePrefix + "_REJECT_REASON_REQUIRED",
                    "a rejection must carry a reason (reviewNote) for the author");
        }
        if (value.length() > MAX_NOTE) {
            throw ContentOperationException.badRequest(codePrefix + "_REJECT_REASON_INVALID",
                    "reviewNote must be at most " + MAX_NOTE + " characters");
        }
        return value;
    }
}
