package com.englishflow.content.port;

import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentVersionId;

/** Cache invalidation seam; invalidation is a consequence of a committed content fact. */
public interface ContentCacheInvalidator {

    void invalidate(ContentId contentId, ContentVersionId versionId, String reason);
}
