package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
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
                || !Boolean.TRUE.equals(properties.security().jwtPrevalidationEnabled())
                || isPublicEdgePath(exchange)) {
            return chain.filter(exchange);
        }

        String authorization = exchange.getRequest().getHeaders().getFirst("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                    401,
                    "jwt_prevalidation_required",
                    "Authentication is required.",
                    valueOrUnknown(exchange, "X-Request-Id"),
                    valueOrUnknown(exchange, "X-Trace-Id")
            ));
        }

        // Presence-only boundary. B8 must replace this with Resource Server/JWKS
        // verification after G-IDP is accepted; a bearer header is not auth.
        return chain.filter(exchange);
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
        if (path.startsWith("/api/v1/auth/oidc/")) {
            return true;
        }
        if (HttpMethod.POST.equals(method)
                && ("/api/v1/iam/session/refresh".equals(path) || "/api/v1/auth/refresh".equals(path))) {
            return true;
        }
        return (HttpMethod.GET.equals(method) || HttpMethod.HEAD.equals(method))
                && "/api/v1/health".equals(path);
    }

    private static String valueOrUnknown(ServerWebExchange exchange, String name) {
        String value = exchange.getRequest().getHeaders().getFirst(name);
        return value == null || value.isBlank() ? "unknown" : value;
    }
}
