package com.englishflow.iam.domain;

/** Persistence-enabled IAM never silently falls back to a JVM-only idempotency store. */
public final class FailClosedIdempotencyStore implements IdempotencyStore {
    private IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }

    @Override public IdempotencyRecord claim(String scope, String key, String requestHash) { throw unavailable(); }
    @Override public IdempotencyRecord complete(String scope, String key, String requestHash,
                                                int responseStatus, String resultReference) {
        throw unavailable();
    }
    @Override public void abandon(String scope, String key, String requestHash) { throw unavailable(); }
}
