package com.englishflow.media.domain;

/** Semantic association owned by content-service; media-service only stores the reference. */
public record MediaContentReference(String contentVersionId, String role, String segmentId) {

    public MediaContentReference {
        contentVersionId = MediaValidation.id(contentVersionId, "contentVersionId");
        role = MediaValidation.text(role, "contentRole", 64);
        segmentId = MediaValidation.optionalText(segmentId, "segmentId", 160);
    }
}
