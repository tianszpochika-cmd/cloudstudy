package com.englishflow.gateway.filter;

import com.englishflow.gateway.support.SecurityAuditRecorder;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Captures the redacted boundary-audit record around the entire Gateway filter
 * chain. The recorder intentionally writes only to the configured sink; the
 * default bounded sink is not represented as durable audit evidence.
 */
@Component
public final class SecurityAuditGlobalFilter implements GlobalFilter, Ordered {

    private final SecurityAuditRecorder recorder;

    public SecurityAuditGlobalFilter(SecurityAuditRecorder recorder) {
        this.recorder = recorder;
    }

    @Override
    public int getOrder() {
        // Place outside the request-context/sanitization/rate filters so it
        // sees their final response status and reason code.
        return Ordered.HIGHEST_PRECEDENCE + 5;
    }

    @Override
    public Mono<Void> filter(
            ServerWebExchange exchange,
            org.springframework.cloud.gateway.filter.GatewayFilterChain chain
    ) {
        long startedAtNanos = System.nanoTime();
        return chain.filter(exchange)
                .then(recorder.record(exchange, startedAtNanos))
                .onErrorResume(failure -> recorder.record(exchange, startedAtNanos)
                        .then(Mono.error(failure)));
    }
}
