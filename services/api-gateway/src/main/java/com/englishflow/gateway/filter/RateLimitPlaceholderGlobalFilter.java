package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class RateLimitPlaceholderGlobalFilter implements GlobalFilter, Ordered {

    private final GatewayProperties properties;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitPlaceholderGlobalFilter(GatewayProperties properties) {
        this.properties = properties;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 30;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        var responseHeaders = exchange.getResponse().getHeaders();
        responseHeaders.set("X-RateLimit-Policy", properties.rateLimit().enabled()
                ? "local-placeholder"
                : "disabled-phase0-placeholder");
        responseHeaders.set("X-RateLimit-Limit", Integer.toString(properties.rateLimit().requestsPerWindow()));

        if (!Boolean.TRUE.equals(properties.rateLimit().enabled())) {
            return chain.filter(exchange);
        }

        String key = key(exchange);
        Window window = windows.computeIfAbsent(key, ignored -> new Window());
        long now = System.currentTimeMillis();
        long windowMillis = properties.rateLimit().window().toMillis();
        synchronized (window) {
            if (now - window.startedAt() >= windowMillis) {
                window.reset(now);
            }
            long used = window.count().incrementAndGet();
            long remaining = Math.max(0, properties.rateLimit().requestsPerWindow() - used);
            responseHeaders.set("X-RateLimit-Remaining", Long.toString(remaining));
            responseHeaders.set("X-RateLimit-Reset", Long.toString((window.startedAt() + windowMillis) / 1000));
            if (used > properties.rateLimit().requestsPerWindow()) {
                responseHeaders.set("Retry-After", Long.toString(Math.max(1, (window.startedAt() + windowMillis - now) / 1000)));
                exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                String requestId = exchange.getRequest().getHeaders().getFirst("X-Request-Id");
                String traceId = exchange.getRequest().getHeaders().getFirst("X-Trace-Id");
                return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                        429,
                        "rate_limited",
                        "Too many requests.",
                        requestId == null ? "unknown" : requestId,
                        traceId == null ? "unknown" : traceId
                ));
            }
        }
        return chain.filter(exchange);
    }

    private String key(ServerWebExchange exchange) {
        if ("remote-address".equalsIgnoreCase(properties.rateLimit().keyStrategy())
                && exchange.getRequest().getRemoteAddress() != null
                && exchange.getRequest().getRemoteAddress().getAddress() != null) {
            return exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();
        }
        return "gateway-default";
    }

    private static final class Window {
        private long startedAt = Instant.now().toEpochMilli();
        private final AtomicLong count = new AtomicLong();

        long startedAt() {
            return startedAt;
        }

        AtomicLong count() {
            return count;
        }

        void reset(long now) {
            startedAt = now;
            count.set(0);
        }
    }
}
