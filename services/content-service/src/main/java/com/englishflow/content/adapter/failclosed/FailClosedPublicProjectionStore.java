package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.PublicContentProjection;
import com.englishflow.content.port.PublicProjectionStore;

import java.util.Optional;

/** Read projection boundary when no content database is configured. */
public final class FailClosedPublicProjectionStore implements PublicProjectionStore {

    @Override
    public Optional<PublicContentProjection> find(
            ContentId contentId,
            ContentVersionId versionId,
            ContentAudience audience) {
        throw ContentPersistenceFailure.unavailable();
    }

    @Override
    public void put(PublicContentProjection projection) {
        throw ContentPersistenceFailure.unavailable();
    }

    @Override
    public void remove(ContentId contentId, ContentVersionId versionId) {
        throw ContentPersistenceFailure.unavailable();
    }
}
