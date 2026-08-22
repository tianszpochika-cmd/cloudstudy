package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.SecurityAuditRecord;
import com.englishflow.gateway.support.SecurityAuditSink;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@Component
public class SecurityAuditGlobalFilter implements GlobalFilter, Ordered {

    private final GatewayProperties properties;
    private final SecurityAuditSink sink;

    public SecurityAuditGlobalFilter(GatewayProperties properties, SecurityAuditSink sink) {
        this.properties = properties;
        this.sink = sink;
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE - 10;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        if (!Boolean.TRUE.equals(properties.security().auditEnabled())) {
            return chain.filter(exchange);
        }
        return chain.filter(exchange)
                .doOnSuccess(ignored -> record(exchange, null))
                .doOnError(failure -> record(exchange, failure.getClass().getSimpleName()));
    }

    private void record(ServerWebExchange exchange, String failureType) {
        HttpStatusCode statusCode = exchange.getResponse().getStatusCode();
        int status = statusCode == null ? 500 : statusCode.value();
        String path = exchange.getRequest().getPath().value();
        if (status != 401 && status != 403 && !path.startsWith("/api/v1/auth/")) {
            return;
        }
        sink.record(new SecurityAuditRecord(
                UUID.randomUUID().toString(),
                safeHeader(exchange, "X-Request-Id"),
                safeHeader(exchange, "X-Trace-Id"),
                exchange.getRequest().getMethod().name(),
                path,
                status,
                failureType == null ? reason(status) : failureType,
                Instant.now()
        ));
    }

    private static String safeHeader(ServerWebExchange exchange, String name) {
        return CorrelationIds.requestId(exchange.getRequest().getHeaders().getFirst(name), 128);
    }

    private static String reason(int status) {
        return switch (status) {
            case 401 -> "authentication_required";
            case 403 -> "policy_denied";
            default -> "auth_boundary";
        };
    }
}
