package com.englishflow.platform.template.reliability;

import java.time.Duration;

/** Finite exponential retry budget shared by dispatchers and consumers. */
public record RetryPolicy(int maxAttempts, Duration initialBackoff, Duration maxBackoff) {

    public RetryPolicy {
        if (maxAttempts < 1 || maxAttempts > 20) {
            throw new IllegalArgumentException("maxAttempts must be between 1 and 20");
        }
        if (initialBackoff == null || initialBackoff.isNegative() || initialBackoff.isZero()) {
            throw new IllegalArgumentException("initialBackoff must be positive");
        }
        if (maxBackoff == null || maxBackoff.compareTo(initialBackoff) < 0) {
            throw new IllegalArgumentException("maxBackoff must not be less than initialBackoff");
        }
    }

    public static RetryPolicy boundedDefault() {
        return new RetryPolicy(5, Duration.ofSeconds(1), Duration.ofMinutes(5));
    }

    public Duration backoffFor(int attempt) {
        if (attempt < 1) {
            throw new IllegalArgumentException("attempt must be positive");
        }
        Duration result = initialBackoff;
        for (int index = 1; index < attempt; index++) {
            if (result.compareTo(maxBackoff) >= 0 || result.compareTo(maxBackoff.dividedBy(2)) > 0) {
                return maxBackoff;
            }
            result = result.multipliedBy(2);
        }
        return result.compareTo(maxBackoff) > 0 ? maxBackoff : result;
    }
}
