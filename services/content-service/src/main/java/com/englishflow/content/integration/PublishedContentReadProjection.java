package com.englishflow.content.integration;

/** Versioned, rights-filtered content fact for learner/assessment consumers. */
public record PublishedContentReadProjection(
        String contentId,
        long contentVersion,
        boolean published,
        boolean rightsActive,
        String rightsReference) {
    public PublishedContentReadProjection {
        require(contentId, "contentId");
        require(rightsReference, "rightsReference");
        if (contentVersion < 1) throw new IllegalArgumentException("contentVersion must be positive");
    }

    public boolean readable() { return published && rightsActive; }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
    }
}
