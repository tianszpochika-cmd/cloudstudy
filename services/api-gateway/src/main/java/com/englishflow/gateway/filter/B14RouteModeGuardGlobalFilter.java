package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import reactor.core.publisher.Mono;

import java.util.Set;

/**
 * Keeps LEGACY/FALLBACK route modes read-only. This is intentionally an edge
 * guard: a rollback must not turn the Java 17 compatibility service into a
 * new cross-domain write owner.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public final class B14RouteModeGuardGlobalFilter implements GlobalFilter, Ordered {
    private static final Set<HttpMethod> READ_METHODS = Set.of(HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS);

    private final GatewayProperties properties;

    public B14RouteModeGuardGlobalFilter(GatewayProperties properties) {
        this.properties = properties;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (!Boolean.TRUE.equals(properties.b14().enabled())) {
            return chain.filter(exchange);
        }
        String domain = phaseOneDomain(exchange);
        if (domain == null) {
            return chain.filter(exchange);
        }
        GatewayProperties.B14Services.RouteMode mode = properties.b14().mode(domain);
        if (mode == GatewayProperties.B14Services.RouteMode.TARGET
                || mode == GatewayProperties.B14Services.RouteMode.SHADOW
                || READ_METHODS.contains(exchange.getRequest().getMethod())) {
            return chain.filter(exchange);
        }

        exchange.getResponse().setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
        exchange.getResponse().getHeaders().set("Retry-After", "60");
        exchange.getResponse().getHeaders().set("X-B14-Route-Mode", mode.name());
        return exchange.getResponse().setComplete();
    }

    private static String phaseOneDomain(ServerWebExchange exchange) {
        String path = exchange.getRequest().getPath().pathWithinApplication().value();
        String prefix = "/api/v1/";
        if (!path.startsWith(prefix) || path.startsWith("/api/v1/public/") || path.startsWith("/api/v1/auth/")) {
            return null;
        }
        String remainder = path.substring(prefix.length());
        int slash = remainder.indexOf('/');
        String domain = slash < 0 ? remainder : remainder.substring(0, slash);
        return GatewayProperties.B14Services.DOMAINS.contains(domain) ? domain : null;
    }
}
