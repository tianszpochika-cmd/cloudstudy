package com.englishflow.iam.oidc;

import java.util.Optional;

/** One-time state transaction store. Production implementations must use an expiring IAM-owned store. */
public interface AuthorizationTransactionPort {

    /** Returns a non-expired transaction without consuming it. */
    Optional<AuthorizationTransaction> find(String state);

    /** Atomically consumes one transaction; durable implementations must use a conditional delete. */
    void save(AuthorizationTransaction transaction);

    Optional<AuthorizationTransaction> consume(String state);

    /** Optional replay signal for stores that retain a short-lived consumed-state marker. */
    default boolean wasConsumed(String state) {
        return false;
    }
}
