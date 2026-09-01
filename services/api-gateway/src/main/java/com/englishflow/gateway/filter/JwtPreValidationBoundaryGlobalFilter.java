package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class JwtPreValidationBoundaryGlobalFilter implements GlobalFilter, Ordered {

    private final GatewayProperties properties;
    private final GatewayRoutePolicy routePolicy;

    public JwtPreValidationBoundaryGlobalFilter(
            GatewayProperties properties,
            GatewayRoutePolicy routePolicy
    ) {
        this.properties = properties;
        this.routePolicy = routePolicy;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 40;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        if (Boolean.TRUE.equals(properties.security().resourceServerEnabled())
                || routePolicy.permitsAnonymous(exchange.getRequest())
                || routePolicy.isKnownPreflight(exchange.getRequest())
                || isActuatorProbe(exchange)) {
            return chain.filter(exchange);
        }

        if (!Boolean.TRUE.equals(properties.security().jwtPrevalidationEnabled())) {
            // The old header-shortcut boundary is intentionally gone. The
            // SecurityWebFilterChain owns the normal fail-closed denyAll path when
            // Resource Server/JWKS validation is disabled; this filter must never
            // turn a bearer-header shortcut into authentication.
            return chain.filter(exchange);
        }

        return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                503,
                "jwt_validation_unavailable",
                "The authentication verifier is unavailable.",
                requestId(exchange),
                traceId(exchange),
                true
        ));
    }

    private static boolean isActuatorProbe(ServerWebExchange exchange) {
        String path = exchange.getRequest().getPath().value();
        return path.startsWith("/actuator/health/") || "/actuator/info".equals(path);
    }

    private String requestId(ServerWebExchange exchange) {
        return CorrelationIds.requestId(
                exchange.getRequest().getHeaders().getFirst("X-Request-Id"),
                properties.requestContext().maxIdLength());
    }

    private String traceId(ServerWebExchange exchange) {
        return CorrelationIds.traceId(
                exchange.getRequest().getHeaders().getFirst("X-Trace-Id"),
                exchange.getRequest().getHeaders().getFirst("traceparent"),
                properties.requestContext().maxIdLength());
    }
}
