package com.englishflow.iam.domain;

/**
 * IAM-owned audit fact sink. A production adapter must be durable, append-only, independently
 * owned and queryable by decision id for replay/export; failure must not be silently ignored.
 */
public interface AuditFactPort {

    void append(AuditDecision decision);
}
