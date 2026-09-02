package com.englishflow.iam.domain;

/** Immutable IAM policy control-plane lifecycle. No transition may skip a state. */
public enum PolicyLifecycleStatus {
    DRAFT,
    SUBMITTED,
    APPROVED,
    ACTIVE,
    REVOKED
}
