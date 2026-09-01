package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.policy.GatewayRouteExecutionPolicy;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayAuditAttributes;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import com.englishflow.gateway.support.SecurityAuditRecorder;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.Arrays;
import java.util.List;

/**
 * Owns preflight admission before Spring's generic CORS support can short-circuit
 * a rejected Origin without the canonical Gateway error envelope or audit event.
 * Actual request CORS response decoration still comes from the configured Spring
 * Security CORS source after this named preflight decision succeeds.
 */
@Component
public final class CanonicalCorsPreflightWebFilter implements WebFilter, Ordered {

    private final GatewayProperties properties;
    private final GatewayRoutePolicy routePolicy;
    private final GatewayRouteExecutionPolicy routeExecutionPolicy;
    private final SecurityAuditRecorder auditRecorder;

    public CanonicalCorsPreflightWebFilter(
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
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        if (!isPreflight(request)) {
            return chain.filter(exchange);
        }

        long startedAtNanos = System.nanoTime();
        String origin = request.getHeaders().getOrigin();
        GatewayProperties.Cors cors = properties.cors();
        GatewayProperties.Cors.OriginProfile profile = cors.profileFor(origin);
        GatewayRoutePolicy.Resolution resolution = routePolicy.resolvePreflight(request);
        if (profile == GatewayProperties.Cors.OriginProfile.UNKNOWN) {
            return deny(exchange, startedAtNanos, "cors_origin_forbidden", "The CORS origin is not trusted.");
        }
        if (!resolution.matched()) {
            return deny(exchange, startedAtNanos, "cors_preflight_route_forbidden", "The CORS route is not available.");
        }
        if (!routeExecutionPolicy.isAvailable(resolution.rule())) {
            return deny(exchange, startedAtNanos, "cors_preflight_target_unavailable", "The CORS route is not available.");
        }
        if (profile == GatewayProperties.Cors.OriginProfile.OFFICIAL_SITE
                && resolution.rule().authClass() != GatewayRoutePolicy.AuthClass.PUBLIC_READ) {
            return deny(exchange, startedAtNanos, "official_site_preflight_forbidden", "Official-site requests are limited to named public reads.");
        }

        String requestedMethod = request.getHeaders().getFirst(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD);
        if (!methodAllowed(profile, requestedMethod, cors) || !requestedHeadersAllowed(profile, request, cors)) {
            return deny(exchange, startedAtNanos, "cors_preflight_headers_or_method_forbidden", "The CORS request is not permitted.");
        }
        return allow(exchange, origin, profile, cors);
    }

    private Mono<Void> allow(
            ServerWebExchange exchange,
            String origin,
            GatewayProperties.Cors.OriginProfile profile,
            GatewayProperties.Cors cors
    ) {
        HttpHeaders headers = exchange.getResponse().getHeaders();
        headers.set(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, origin);
        headers.set(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, String.join(",", allowedMethods(profile, cors)));
        headers.set(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, String.join(",", allowedHeaders(profile, cors)));
        headers.set(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, cors.exposedHeaders());
        headers.set(HttpHeaders.ACCESS_CONTROL_MAX_AGE, Long.toString(cors.maxAge().toSeconds()));
        if (cors.isCredentialedProfile(profile)) {
            headers.set(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true");
        }
        headers.add(HttpHeaders.VARY, HttpHeaders.ORIGIN);
        headers.add(HttpHeaders.VARY, HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD);
        headers.add(HttpHeaders.VARY, HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS);
        headers.set("X-Request-Id", requestId(exchange));
        headers.set("X-Trace-Id", traceId(exchange));
        headers.set("X-API-Version", "v1");
        exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.OK);
        return exchange.getResponse().setComplete();
    }

    private Mono<Void> deny(ServerWebExchange exchange, long startedAtNanos, String reasonCode, String message) {
        GatewayAuditAttributes.setReasonCode(exchange, reasonCode);
        return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                        403,
                        "forbidden",
                        message,
                        requestId(exchange),
                        traceId(exchange),
                        false
                ))
                .then(auditRecorder.record(exchange, startedAtNanos));
    }

    private static boolean isPreflight(ServerHttpRequest request) {
        return HttpMethod.OPTIONS.equals(request.getMethod())
                && request.getHeaders().getFirst(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD) != null;
    }

    private static boolean methodAllowed(
            GatewayProperties.Cors.OriginProfile profile,
            String requestedMethod,
            GatewayProperties.Cors cors
    ) {
        if (requestedMethod == null || requestedMethod.isBlank()) {
            return false;
        }
        return allowedMethods(profile, cors).stream().anyMatch(method -> method.equalsIgnoreCase(requestedMethod.trim()));
    }

    private static boolean requestedHeadersAllowed(
            GatewayProperties.Cors.OriginProfile profile,
            ServerHttpRequest request,
            GatewayProperties.Cors cors
    ) {
        String requested = request.getHeaders().getFirst(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS);
        if (requested == null || requested.isBlank()) {
            return true;
        }
        List<String> allowed = allowedHeaders(profile, cors);
        return Arrays.stream(requested.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .allMatch(value -> allowed.stream().anyMatch(candidate -> candidate.equalsIgnoreCase(value)));
    }

    private static List<String> allowedMethods(GatewayProperties.Cors.OriginProfile profile, GatewayProperties.Cors cors) {
        return profile == GatewayProperties.Cors.OriginProfile.OFFICIAL_SITE
                ? List.of(HttpMethod.GET.name())
                : csv(cors.allowedMethods());
    }

    private static List<String> allowedHeaders(GatewayProperties.Cors.OriginProfile profile, GatewayProperties.Cors cors) {
        return profile == GatewayProperties.Cors.OriginProfile.OFFICIAL_SITE
                ? csv(cors.publicAllowedHeaders())
                : csv(cors.credentialedAllowedHeaders());
    }

    private static List<String> csv(String value) {
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .toList();
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
