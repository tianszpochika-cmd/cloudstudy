package com.englishflow.content.domain;

/** Canonical ADM state; rejected/rollback are actions, not hidden alternate states. */
public enum ContentVersionStatus {
    DRAFT,
    IN_REVIEW,
    APPROVED,
    PUBLISHED,
    ARCHIVED
}
