package com.englishflow.gateway.rate;

public final class RateLimitBackendUnavailableException extends RuntimeException {

    public RateLimitBackendUnavailableException(Throwable cause) {
        super("rate-limit-backend-unavailable", cause);
    }
}
