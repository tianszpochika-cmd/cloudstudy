package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.PublicContentProjection;
import com.englishflow.content.port.PublicProjectionStore;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Rebuildable read model test double; it never accepts write commands. */
public final class InMemoryPublicProjectionStore implements PublicProjectionStore {

    private final Map<String, PublicContentProjection> projections = new ConcurrentHashMap<>();

    @Override
    public Optional<PublicContentProjection> find(
            ContentId contentId,
            ContentVersionId versionId,
            ContentAudience audience) {
        return Optional.ofNullable(projections.get(key(contentId, versionId, audience)));
    }

    @Override
    public void put(PublicContentProjection projection) {
        projections.put(key(projection.contentId(), projection.versionId(), projection.audience()), projection);
    }

    @Override
    public void remove(ContentId contentId, ContentVersionId versionId) {
        projections.keySet().removeIf(key -> key.startsWith(contentId.value() + ":" + versionId.value() + ":"));
    }

    private static String key(ContentId contentId, ContentVersionId versionId, ContentAudience audience) {
        return contentId.value() + ":" + versionId.value() + ":" + audience.name();
    }
}
