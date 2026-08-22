package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.port.ContentCacheInvalidator;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Test seam for asserting publish/unpublish/rollback cache invalidation. */
public final class RecordingContentCacheInvalidator implements ContentCacheInvalidator {

    private final List<Invalidation> invalidations = new ArrayList<>();

    @Override
    public synchronized void invalidate(ContentId contentId, ContentVersionId versionId, String reason) {
        invalidations.add(new Invalidation(contentId, versionId, reason));
    }

    public synchronized List<Invalidation> invalidations() {
        return Collections.unmodifiableList(new ArrayList<>(invalidations));
    }

    public record Invalidation(ContentId contentId, ContentVersionId versionId, String reason) {
    }
}
