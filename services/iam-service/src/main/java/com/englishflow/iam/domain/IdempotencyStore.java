package com.englishflow.iam.domain;

import java.time.Duration;
import java.time.Instant;

/** Cross-process idempotency claim/replay boundary. */
public interface IdempotencyStore {

    /** Atomically claims a key or returns its completed result. */
    IdempotencyRecord claim(String scope, String key, String requestHash);

    /** Stores the response only for the matching in-progress request claim. */
    IdempotencyRecord complete(String scope, String key, String requestHash,
                               int responseStatus, String resultReference);

    /**
     * Stores a completed response without exposing its body or headers to the persistence
     * adapter. Existing local adapters may use the compatibility implementation, but durable
     * adapters override this method to persist only encrypted snapshot material.
     */
    default IdempotencyRecord complete(String scope, String key, String requestHash,
                                       int responseStatus, String resultReference,
                                       IdempotencyRecord.ResponseSnapshot snapshot) {
        return complete(scope, key, requestHash, responseStatus, resultReference);
    }

    /** Commits a deterministic policy rejection so a retry cannot repeat a security write. */
    default IdempotencyRecord reject(String scope, String key, String requestHash,
                                     IamPolicyException exception) {
        return reject(scope, key, requestHash, exception, 400);
    }

    /** Commits a rejection together with the HTTP status selected by the IAM error policy. */
    default IdempotencyRecord reject(String scope, String key, String requestHash,
                                     IamPolicyException exception, int responseStatus) {
        throw new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }

    /** Removes claims beyond the bounded replay-retention window. */
    default void purgeExpired(Instant now, Duration retention) {}

    /** Releases a claim when the business operation failed before a response was produced. */
    void abandon(String scope, String key, String requestHash);
}
