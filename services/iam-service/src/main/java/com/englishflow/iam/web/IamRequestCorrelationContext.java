package com.englishflow.iam.web;

import java.util.Optional;

/**
 * Request-scoped correlation values used by the IAM durable audit adapter.
 *
 * <p>The Gateway is the normal source of these values, but IAM also owns the
 * boundary when it is called directly during local verification. Values are
 * kept only for the current servlet thread and are always cleared by the
 * filter.</p>
 */
public final class IamRequestCorrelationContext {

    private static final ThreadLocal<Correlation> CURRENT = new ThreadLocal<>();

    private IamRequestCorrelationContext() {}

    public static void set(String requestId, String traceId) {
        CURRENT.set(new Correlation(requestId, traceId));
    }

    public static Optional<Correlation> current() {
        return Optional.ofNullable(CURRENT.get());
    }

    public static void clear() {
        CURRENT.remove();
    }

    public record Correlation(String requestId, String traceId) {}
}
