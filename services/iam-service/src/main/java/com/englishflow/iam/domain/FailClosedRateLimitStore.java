package com.englishflow.iam.domain;

import java.time.Duration;
import java.time.Instant;

/** Refuses authentication traffic when the configured durable rate-limit store is unavailable. */
public final class FailClosedRateLimitStore implements RateLimitStore {
    @Override
    public boolean allow(String scope, String keyDigest, Instant now, int limit, Duration window) {
        throw new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
