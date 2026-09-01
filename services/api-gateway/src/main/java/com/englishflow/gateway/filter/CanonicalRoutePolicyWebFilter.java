package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import com.englishflow.gateway.policy.GatewayRouteExecutionPolicy;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayAuditAttributes;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import com.englishflow.gateway.support.SecurityAuditRecorder;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/**
 * Applies the canonical route policy before WebFlux can select a Gateway route.
 * A broad compatibility/strangler predicate must never turn a method or path
 * absent from the D2 policy into an upstream request.
 */
@Component
public final class CanonicalRoutePolicyWebFilter implements WebFilter, Ordered {

    private final GatewayProperties properties;
    private final GatewayRoutePolicy routePolicy;
    private final GatewayRouteExecutionPolicy routeExecutionPolicy;
    private final SecurityAuditRecorder auditRecorder;

    public CanonicalRoutePolicyWebFilter(
            GatewayProperties properties,
            GatewayRoutePolicy routePolicy,
            GatewayRouteExecutionPolicy routeExecutionPolicy,
            SecurityAuditRecorder auditRecorder
    ) {
        this.properties = properties;
        this.routePolicy = routePolicy;
        this.routeExecutionPolicy = routeExecutionPolicy;
        this.auditRecorder = auditRecorder;
    }

    @Override
    public int getOrder() {
        // Keep this ahead of Spring Security and RoutePredicateHandlerMapping;
        // CORS has its own highest-precedence handling for known preflight.
        return Ordered.HIGHEST_PRECEDENCE + 1;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        if (isActuator(request) || routePolicy.isKnownPreflight(request)) {
            return chain.filter(exchange);
        }

        String path = request.getPath().pathWithinApplication().value();
        if (isExternalInternal(path)) {
            return deny(exchange, "internal_route_not_public", "Internal routes are not public.");
        }
        if (isApiNamespace(path) && !isCanonicalPublicApi(path)) {
            return deny(exchange, "unsupported_api_version", "The API version is not supported.");
        }
        if (!isCanonicalPublicApi(path)) {
            return deny(exchange, "unknown_api_route", "The API route is not available.");
        }

        GatewayRoutePolicy.Resolution resolution = routePolicy.resolve(request);
        if (!resolution.matched()) {
            String code = resolution.status() == GatewayRoutePolicy.ResolutionStatus.AMBIGUOUS
                    ? "ambiguous_api_route"
                    : "unknown_api_route";
            return deny(exchange, code, "The API route is not available.");
        }
        if (!routeExecutionPolicy.isAvailable(resolution.rule())) {
            // A canonical contract route must not fall through to a configured
            // broad predicate when its exact owner target is disabled, not in
            // B14 TARGET mode, or not configured at all.
            return deny(exchange, "canonical_route_target_unavailable", "The API route is not available.");
        }
        return chain.filter(exchange);
    }

    private Mono<Void> deny(ServerWebExchange exchange, String code, String message) {
        long startedAtNanos = System.nanoTime();
        GatewayAuditAttributes.setReasonCode(exchange, code);
        return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                        404,
                        code,
                        message,
                        requestId(exchange),
                        traceId(exchange)
                ))
                .then(auditRecorder.record(exchange, startedAtNanos));
    }

    private static boolean isActuator(ServerHttpRequest request) {
        String path = request.getPath().pathWithinApplication().value();
        return path.equals("/actuator") || path.startsWith("/actuator/");
    }

    private static boolean isExternalInternal(String path) {
        return path.equals("/internal")
                || path.startsWith("/internal/")
                || path.equals("/api/v1/internal")
                || path.startsWith("/api/v1/internal/");
    }

    private static boolean isApiNamespace(String path) {
        return path.equals("/api") || path.startsWith("/api/");
    }

    private static boolean isCanonicalPublicApi(String path) {
        return path.equals("/api/v1") || path.startsWith("/api/v1/");
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
