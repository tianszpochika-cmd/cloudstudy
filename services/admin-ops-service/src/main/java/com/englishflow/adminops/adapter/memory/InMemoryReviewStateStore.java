package com.englishflow.adminops.adapter.memory;

import com.englishflow.adminops.domain.Domain;
import com.englishflow.adminops.domain.ReviewStateRecord;
import com.englishflow.adminops.domain.ReviewStateStore;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Explicit non-production adapter used by unit tests and the non-local-real profile. */
public final class InMemoryReviewStateStore implements ReviewStateStore {

    private final Map<String, ReviewStateRecord> states = new ConcurrentHashMap<>();

    @Override
    public Optional<ReviewStateRecord> find(String tenantId, Domain domain, String resourceRef,
            String projectionVersion) {
        return Optional.ofNullable(states.get(key(tenantId, domain, resourceRef, projectionVersion)));
    }

    @Override
    public void save(ReviewStateRecord state) {
        states.put(key(state.tenantId(), state.domain(), state.resourceRef(), state.projectionVersion()), state);
    }

    private static String key(String tenantId, Domain domain, String resourceRef, String projectionVersion) {
        return tenantId + ':' + domain + ':' + resourceRef + ':' + projectionVersion;
    }
}
