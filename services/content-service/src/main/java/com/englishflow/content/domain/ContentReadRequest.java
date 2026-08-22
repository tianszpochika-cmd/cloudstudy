package com.englishflow.content.domain;

import java.util.Objects;
import java.util.Optional;

/** Read request with an explicit audience and optional version pin. */
public record ContentReadRequest(
        ContentId contentId,
        ContentAudience audience,
        ContentChannel channel,
        Optional<ContentVersionId> pinnedVersionId,
        boolean allowPreviouslyPublishedPin,
        ContentActor actor) {

    public ContentReadRequest {
        Objects.requireNonNull(contentId, "content id is required");
        Objects.requireNonNull(audience, "content audience is required");
        Objects.requireNonNull(channel, "content channel is required");
        pinnedVersionId = pinnedVersionId == null ? Optional.empty() : pinnedVersionId;
        if (audience == ContentAudience.PUBLIC && allowPreviouslyPublishedPin) {
            throw ContentOperationException.forbidden(
                    "PUBLIC_PIN_FORBIDDEN", "public readers cannot pin an unpublished version");
        }
        if (audience == ContentAudience.ASSESSMENT && actor == null) {
            throw ContentOperationException.forbidden(
                    "ASSESSMENT_AUTH_REQUIRED", "assessment snapshots require a verified service actor");
        }
    }

    public static ContentReadRequest publicContent(ContentId contentId) {
        return new ContentReadRequest(contentId, ContentAudience.PUBLIC, ContentChannel.PUBLIC,
                Optional.empty(), false, null);
    }

    public static ContentReadRequest learnerContent(
            ContentId contentId,
            ContentVersionId pinnedVersionId,
            boolean allowPreviouslyPublishedPin) {
        return new ContentReadRequest(contentId, ContentAudience.LEARNER, ContentChannel.LEARNER,
                Optional.ofNullable(pinnedVersionId), allowPreviouslyPublishedPin, null);
    }
}
