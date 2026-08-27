package com.englishflow.content.integration;

import java.util.Optional;

/** Content owner read port. A revoked or unpublished version must not be projected as success. */
public interface PublishedContentReadProjectionPort {
    Optional<PublishedContentReadProjection> findPublished(String contentId, long expectedVersion, String tenantId, String subject);
}
