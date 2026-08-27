package com.englishflow.adminops.domain;

import java.util.Optional;

/** Owner port for durable admin approval state. */
public interface ReviewStateStore {

    Optional<ReviewStateRecord> find(String tenantId, Domain domain, String resourceRef, String projectionVersion);

    void save(ReviewStateRecord state);
}
