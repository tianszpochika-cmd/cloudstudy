package com.englishflow.iam.domain;

/** IAM-owned audit fact sink. A production adapter must be durable and independently owned. */
public interface AuditFactPort {

    void append(AuditDecision decision);
}
