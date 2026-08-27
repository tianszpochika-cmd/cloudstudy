package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.port.ContentCacheInvalidator;

/** Cache invalidation cannot hide a missing content fact store. */
public final class FailClosedContentCacheInvalidator implements ContentCacheInvalidator {

    @Override
    public void invalidate(ContentId contentId, ContentVersionId versionId, String reason) {
        throw ContentPersistenceFailure.unavailable();
    }
}
