package com.englishflow.platform.template.observability;

import java.util.Optional;

/**
 * Request-scoped correlation context for code that needs IDs without trusting client identity
 * headers as authorization facts.
 */
public record RequestContext(String requestId, String traceId) {

    private static final ThreadLocal<RequestContext> CURRENT = new ThreadLocal<>();

    public static Optional<RequestContext> current() {
        return Optional.ofNullable(CURRENT.get());
    }

    static Scope open(String requestId, String traceId) {
        RequestContext previous = CURRENT.get();
        CURRENT.set(new RequestContext(requestId, traceId));
        return () -> {
            if (previous == null) {
                CURRENT.remove();
            } else {
                CURRENT.set(previous);
            }
        };
    }

    @FunctionalInterface
    interface Scope extends AutoCloseable {

        @Override
        void close();
    }
}
