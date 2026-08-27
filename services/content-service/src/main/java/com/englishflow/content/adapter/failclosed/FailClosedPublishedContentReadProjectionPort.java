package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.integration.PublishedContentReadProjection;
import com.englishflow.content.integration.PublishedContentReadProjectionPort;

import java.util.Optional;

/** Cross-service content reads fail closed while the content owner has no durable store. */
public final class FailClosedPublishedContentReadProjectionPort
        implements PublishedContentReadProjectionPort {

    @Override
    public Optional<PublishedContentReadProjection> findPublished(
            String contentId,
            long expectedVersion,
            String tenantId,
            String subject) {
        throw ContentPersistenceFailure.unavailable();
    }
}
