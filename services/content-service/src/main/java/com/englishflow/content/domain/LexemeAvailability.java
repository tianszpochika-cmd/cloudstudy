package com.englishflow.content.domain;

/** Lexeme lifecycle. Only the listed transitions are legal; the service enforces them. */
public enum LexemeAvailability {
    DRAFT,
    IN_REVIEW,
    APPROVED,
    PUBLISHED,
    ARCHIVED;

    public boolean canSubmit() {
        return this == DRAFT;
    }

    public boolean canReview() {
        return this == IN_REVIEW;
    }

    public boolean canApprove() {
        return this == IN_REVIEW;
    }

    public boolean canPublish() {
        return this == APPROVED;
    }

    public boolean canUnpublish() {
        return this == PUBLISHED;
    }

    public boolean canArchive() {
        return this == DRAFT || this == APPROVED || this == PUBLISHED;
    }

    public static LexemeAvailability parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw ContentOperationException.badRequest("LEXEME_STATUS_INVALID", "lexeme availability is required");
        }
        try {
            return LexemeAvailability.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException error) {
            throw ContentOperationException.badRequest("LEXEME_STATUS_INVALID", "lexeme availability is invalid");
        }
    }
}
