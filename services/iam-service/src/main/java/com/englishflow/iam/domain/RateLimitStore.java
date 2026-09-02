package com.englishflow.iam.domain;

import java.time.Duration;
import java.time.Instant;

/** Account/identifier keyed request window owned by IAM. */
public interface RateLimitStore {

    /** Atomically consumes one request slot, returning false once the window is exhausted. */
    boolean allow(String scope, String keyDigest, Instant now, int limit, Duration window);
}
