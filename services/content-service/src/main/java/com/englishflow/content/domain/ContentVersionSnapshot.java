package com.englishflow.content.domain;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/** Internal command/admin snapshot. Public and learner callers must use ContentReadService. */
public record ContentVersionSnapshot(
        ContentId contentId,
        ContentVersionId versionId,
        int versionNumber,
        long stateVersion,
        ContentKind kind,
        ContentVersionStatus status,
        Map<String, Object> payload,
        String contentHash,
        String editor,
        Optional<String> firstReviewer,
        Optional<String> finalReviewer,
        Optional<String> publisher,
        Optional<Instant> publishedAt,
        Optional<Instant> archivedAt,
        Optional<ContentVersionId> rollbackOfVersionId,
        boolean copyrightAttached) {

    public static ContentVersionSnapshot from(ContentId contentId, ContentVersion version) {
        return new ContentVersionSnapshot(
                contentId,
                version.versionId(),
                version.versionNumber(),
                version.stateVersion(),
                version.kind(),
                version.status(),
                version.payload().raw(),
                version.contentHash(),
                version.editor(),
                version.firstReviewer(),
                version.finalReviewer(),
                version.publisher(),
                version.publishedAt(),
                version.archivedAt(),
                version.rollbackOfVersionId(),
                version.rights().isPresent());
    }
}
