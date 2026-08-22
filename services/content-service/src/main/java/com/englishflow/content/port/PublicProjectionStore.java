package com.englishflow.content.port;

import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.PublicContentProjection;

import java.util.Optional;

/** Rebuildable read projection; it is never used as a write source for content facts. */
public interface PublicProjectionStore {

    Optional<PublicContentProjection> find(
            ContentId contentId,
            ContentVersionId versionId,
            ContentAudience audience);

    void put(PublicContentProjection projection);

    void remove(ContentId contentId, ContentVersionId versionId);
}
