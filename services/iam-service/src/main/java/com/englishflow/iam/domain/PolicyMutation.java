package com.englishflow.iam.domain;

/** Result of a durable policy mutation; response adapters render its exact B8 envelope. */
public record PolicyMutation(PolicyVersionRecord policy, PolicyAuditRecord audit,
                             PolicyCacheInvalidationReceipt cacheInvalidation) {}
