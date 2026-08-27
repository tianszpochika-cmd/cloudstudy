package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.rate.RateLimitBackend;
import com.englishflow.gateway.rate.RateLimitBackendUnavailableException;
import com.englishflow.gateway.rate.RateLimitDecision;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.util.Locale;

/**
 * Enforces a real fixed-window admission policy before a request reaches an
 * upstream route. The backend is memory for deterministic local runs or
 * Redis for a multi-instance deployment; both paths expose the same contract.
 */
@Component
public final class RateLimitGlobalFilter implements GlobalFilter, Ordered {

    private final GatewayProperties properties;
    private final RateLimitBackend backend;

    public RateLimitGlobalFilter(GatewayProperties properties, RateLimitBackend backend) {
        this.properties = properties;
        this.backend = backend;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 30;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        GatewayProperties.RateLimit policy = properties.rateLimit();
        var responseHeaders = exchange.getResponse().getHeaders();
        responseHeaders.set("X-RateLimit-Policy", policy.backend().trim().toLowerCase(Locale.ROOT) + "-fixed-window");
        responseHeaders.set("X-RateLimit-Limit", Integer.toString(policy.requestsPerWindow()));

        if (!Boolean.TRUE.equals(policy.enabled())) {
            return chain.filter(exchange);
        }

        return key(exchange)
                .flatMap(key -> decision(key, policy))
                .flatMap(decision -> {
                    applyHeaders(responseHeaders, decision);
                    if (!decision.allowed()) {
                        responseHeaders.set("Retry-After", Long.toString(secondsUntilReset(decision)));
                        return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                                HttpStatus.TOO_MANY_REQUESTS.value(),
                                "rate_limited",
                                "Too many requests.",
                                requestId(exchange),
                                traceId(exchange),
                                true
                        ));
                    }
                    return chain.filter(exchange);
                })
                .onErrorResume(RateLimitBackendUnavailableException.class, ignored -> {
                    responseHeaders.set("X-RateLimit-Backend", "unavailable");
                    return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                            HttpStatus.SERVICE_UNAVAILABLE.value(),
                            "rate_limit_unavailable",
                            "The rate-limit service is unavailable.",
                            requestId(exchange),
                            traceId(exchange),
                            true
                    ));
                });
    }

    private Mono<RateLimitDecision> decision(String key, GatewayProperties.RateLimit policy) {
        return backend.consume(key, policy)
                .onErrorMap(failure -> new RateLimitBackendUnavailableException(failure));
    }

    private Mono<String> key(ServerWebExchange exchange) {
        String strategy = properties.rateLimit().keyStrategy().trim().toLowerCase(Locale.ROOT);
        if ("principal".equals(strategy)) {
            return exchange.getPrincipal()
                    .map(principal -> bounded("principal:" + principal.getName()))
                    .defaultIfEmpty("principal:anonymous");
        }
        InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
        if (remoteAddress == null || remoteAddress.getAddress() == null) {
            return Mono.just("remote:unknown");
        }
        return Mono.just(bounded("remote:" + remoteAddress.getAddress().getHostAddress()));
    }

    private static void applyHeaders(
            org.springframework.http.HttpHeaders headers,
            RateLimitDecision decision
    ) {
        headers.set("X-RateLimit-Remaining", Long.toString(decision.remaining()));
        headers.set("X-RateLimit-Reset", Long.toString(decision.resetEpochSecond()));
    }

    private static long secondsUntilReset(RateLimitDecision decision) {
        return Math.max(1L, decision.resetEpochSecond() - (System.currentTimeMillis() / 1000L));
    }

    private static String bounded(String value) {
        return value.length() <= 256 ? value : value.substring(0, 256);
    }

    private static String requestId(ServerWebExchange exchange) {
        return CorrelationIds.requestId(exchange.getRequest().getHeaders().getFirst("X-Request-Id"), 128);
    }

    private static String traceId(ServerWebExchange exchange) {
        return CorrelationIds.traceId(
                exchange.getRequest().getHeaders().getFirst("X-Trace-Id"),
                exchange.getRequest().getHeaders().getFirst("traceparent"),
                128
        );
    }
}
