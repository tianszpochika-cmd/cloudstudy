package com.englishflow.adminops.domain;

import java.time.Instant;

/** Admin-owned approval state; it contains reviewer references, never copied content facts. */
public record ReviewStateRecord(
        String tenantId,
        Domain domain,
        String resourceRef,
        String projectionVersion,
        String firstReviewerSubjectId,
        String finalReviewerSubjectId,
        Instant updatedAt) {

    public ReviewStateRecord {
        if (tenantId == null || tenantId.isBlank() || domain == null || resourceRef == null
                || resourceRef.isBlank() || projectionVersion == null || projectionVersion.isBlank()
                || updatedAt == null) {
            throw AdminOpsException.invalid("ADMIN_REVIEW_STATE_INVALID", "review state identity is incomplete");
        }
    }
}
