package com.englishflow.gateway.rate;

import com.englishflow.gateway.config.GatewayProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Bounded single-instance backend for local development and deterministic
 * tests. Production multi-instance deployments should select the Redis
 * backend; this backend deliberately never presents itself as distributed.
 */
@Component
@ConditionalOnProperty(
        prefix = "gateway.rate-limit",
        name = "backend",
        havingValue = "memory",
        matchIfMissing = true
)
public final class InMemoryRateLimitBackend implements RateLimitBackend {

    private final GatewayProperties properties;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public InMemoryRateLimitBackend(GatewayProperties properties) {
        this.properties = properties;
    }

    @Override
    public Mono<RateLimitDecision> consume(String key, GatewayProperties.RateLimit policy) {
        long now = System.currentTimeMillis();
        Window window = windows.computeIfAbsent(key, ignored -> {
            evictIfNeeded(policy.maxKeys());
            return new Window(now, policy.window().toMillis());
        });

        synchronized (window) {
            long windowMillis = policy.window().toMillis();
            if (now >= window.resetAtMillis()) {
                window.reset(now, windowMillis);
            }
            long used = ++window.used;
            long remaining = Math.max(0, policy.requestsPerWindow() - used);
            return Mono.just(new RateLimitDecision(
                    used <= policy.requestsPerWindow(),
                    policy.requestsPerWindow(),
                    remaining,
                    (window.resetAtMillis() + 999) / 1000
            ));
        }
    }

    private void evictIfNeeded(int maxKeys) {
        if (windows.size() < maxKeys) {
            return;
        }
        String oldestKey = windows.entrySet().stream()
                .min((left, right) -> Long.compare(left.getValue().resetAtMillis(), right.getValue().resetAtMillis()))
                .map(Map.Entry::getKey)
                .orElse(null);
        if (oldestKey != null) {
            windows.remove(oldestKey);
        }
    }

    private static final class Window {
        private long resetAtMillis;
        private long used;

        private Window(long startedAtMillis, long windowMillis) {
            reset(startedAtMillis, windowMillis);
        }

        private void reset(long startedAtMillis, long windowMillis) {
            resetAtMillis = startedAtMillis + windowMillis;
            used = 0;
        }

        private long resetAtMillis() {
            return resetAtMillis;
        }
    }
}
