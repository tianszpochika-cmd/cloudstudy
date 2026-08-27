package com.englishflow.gateway.rate;

/**
 * The outcome of one fixed-window admission decision.
 *
 * @param allowed whether the request may continue
 * @param limit configured requests per window
 * @param remaining requests still available in the current window
 * @param resetEpochSecond epoch second at which the window resets
 */
public record RateLimitDecision(
        boolean allowed,
        int limit,
        long remaining,
        long resetEpochSecond
) {
}
