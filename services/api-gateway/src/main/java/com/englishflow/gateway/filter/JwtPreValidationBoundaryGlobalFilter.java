package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class JwtPreValidationBoundaryGlobalFilter implements GlobalFilter, Ordered {

    private final GatewayProperties properties;

    public JwtPreValidationBoundaryGlobalFilter(GatewayProperties properties) {
        this.properties = properties;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 40;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        if (Boolean.TRUE.equals(properties.security().resourceServerEnabled())
                || isPublicEdgePath(exchange)) {
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

    private static boolean isPublicEdgePath(ServerWebExchange exchange) {
        String path = exchange.getRequest().getPath().value();
        HttpMethod method = exchange.getRequest().getMethod();
        if (path.startsWith("/actuator/")) {
            return true;
        }
        if (HttpMethod.OPTIONS.equals(method) && path.startsWith("/api/")) {
            return true;
        }
        if ((HttpMethod.GET.equals(method) || HttpMethod.POST.equals(method))
                && path.startsWith("/api/v1/auth/oidc/")) {
            return true;
        }
        if (HttpMethod.POST.equals(method)
                && ("/api/v1/iam/session/refresh".equals(path) || "/api/v1/auth/refresh".equals(path))) {
            return true;
        }
        return (HttpMethod.GET.equals(method) || HttpMethod.HEAD.equals(method))
                && "/api/v1/health".equals(path);
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
