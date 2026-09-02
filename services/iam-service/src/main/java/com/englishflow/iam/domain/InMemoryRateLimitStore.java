package com.englishflow.iam.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Local-only rate limiter; production persistence selects the JDBC implementation. */
public final class InMemoryRateLimitStore implements RateLimitStore {
    private final Map<String, Window> windows = new HashMap<>();

    @Override
    public synchronized boolean allow(String scope, String keyDigest, Instant now, int limit, Duration window) {
        if (limit <= 0) return false;
        Duration effectiveWindow = window == null || window.isNegative() || window.isZero()
                ? Duration.ofMinutes(1) : window;
        String key = scope + "\u0000" + keyDigest;
        Window current = windows.get(key);
        if (current == null || !now.isBefore(current.startedAt().plus(effectiveWindow))) {
            current = new Window(now, 0);
        }
        if (current.count() >= limit) {
            windows.put(key, current);
            return false;
        }
        windows.put(key, new Window(current.startedAt(), current.count() + 1));
        return true;
    }

    private record Window(Instant startedAt, int count) {}
}
