package com.englishflow.content.domain;

import java.time.Instant;
import java.util.Optional;

/** Safe command result; payloads are returned through an explicit audience projection. */
public record ContentDefinitionSnapshot(
        ContentId contentId,
        String tenantId,
        String contentCode,
        ContentKind kind,
        String title,
        String locale,
        String targetLevel,
        String goalCode,
        Optional<ContentVersionId> currentPublishedVersionId,
        int versionCount,
        Instant createdAt) {

    public static ContentDefinitionSnapshot from(ContentDefinition content) {
        return new ContentDefinitionSnapshot(
                content.contentId(),
                content.tenantId(),
                content.contentCode(),
                content.kind(),
                content.title(),
                content.locale(),
                content.targetLevel(),
                content.goalCode(),
                content.currentPublishedVersionId(),
                content.versions().size(),
                content.createdAt());
    }
}
