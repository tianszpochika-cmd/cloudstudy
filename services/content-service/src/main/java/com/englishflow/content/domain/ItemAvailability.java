package com.englishflow.content.domain;

/** Row-level item lifecycle (question/example/grammar/passage/exercise). */
public enum ItemAvailability {
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

    public boolean canPublish() {
        return this == APPROVED;
    }

    public boolean canUnpublish() {
        return this == PUBLISHED;
    }

    public boolean canArchive() {
        return this == DRAFT || this == APPROVED || this == PUBLISHED;
    }

    public static ItemAvailability parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw ContentOperationException.badRequest("ITEM_STATUS_INVALID", "item availability is required");
        }
        try {
            return ItemAvailability.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException error) {
            throw ContentOperationException.badRequest("ITEM_STATUS_INVALID", "item availability is invalid");
        }
    }
}
