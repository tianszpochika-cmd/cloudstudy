package com.englishflow.gateway.filter;

import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Set;

/** Client supplied role, tenant and owner headers are never authorization facts. */
@Component
public class ClientAuthorizationContextSanitizerGlobalFilter implements GlobalFilter, Ordered {

    private static final Set<String> FORGED_CONTEXT_HEADERS = Set.of(
            "X-B5-Role",
            "X-Role",
            "X-Tenant-Id",
            "X-Owner-Id",
            "X-Subject-Id",
            "X-Permissions",
            "X-Policy-Version"
    );

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 15;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        var request = exchange.getRequest().mutate()
                .headers(headers -> FORGED_CONTEXT_HEADERS.forEach(headers::remove))
                .build();
        return chain.filter(exchange.mutate().request(request).build());
    }
}
