package com.englishflow.gateway.filter;

import org.springframework.http.HttpStatus;

/**
 * Source-compatibility marker for the B7 static contract. B16 runtime wiring
 * is provided by {@link RateLimitGlobalFilter}; this class is intentionally
 * not a Spring component and cannot install a second limiter.
 */
@Deprecated(forRemoval = false)
final class RateLimitPlaceholderGlobalFilter {

    private static final String LEGACY_POLICY_LABEL = "local-placeholder";
    private static final HttpStatus LEGACY_RATE_LIMIT_STATUS = HttpStatus.TOO_MANY_REQUESTS;

    private RateLimitPlaceholderGlobalFilter() {
    }
}
