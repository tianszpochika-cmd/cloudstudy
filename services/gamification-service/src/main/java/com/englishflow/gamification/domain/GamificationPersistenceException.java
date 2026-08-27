package com.englishflow.gamification.domain;

/**
 * Explicit fail-closed boundary for persistence that is not safe to emulate.
 *
 * <p>This exception is deliberately transport-independent. The HTTP adapter maps it to a
 * retryable 503, while non-HTTP callers still receive a clear failure instead of an empty or
 * synthetic aggregate.</p>
 */
public final class GamificationPersistenceException extends RuntimeException {

    private final boolean retryable;

    public GamificationPersistenceException(String message) {
        this(message, null);
    }

    public GamificationPersistenceException(String message, Throwable cause) {
        super(message, cause);
        this.retryable = true;
    }

    public boolean retryable() {
        return retryable;
    }

    public static GamificationPersistenceException localRealUnavailable(String capability) {
        return new GamificationPersistenceException(
                "local-real persistence capability is unavailable: " + capability);
    }
}
