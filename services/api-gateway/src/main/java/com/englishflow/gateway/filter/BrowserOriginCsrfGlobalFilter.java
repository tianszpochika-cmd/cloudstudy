package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayAuditAttributes;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.Set;

/**
 * Enforces the M1-004 browser-origin boundary before a cookie-authenticated
 * request is forwarded. SameSite is defence in depth; it never replaces this
 * exact Origin/Referer decision.
 */
@Component
public final class BrowserOriginCsrfGlobalFilter implements GlobalFilter, Ordered {

    private static final Set<HttpMethod> UNSAFE_METHODS = Set.of(
            HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE
    );

    private final GatewayProperties properties;
    private final GatewayRoutePolicy routePolicy;

    public BrowserOriginCsrfGlobalFilter(GatewayProperties properties, GatewayRoutePolicy routePolicy) {
        this.properties = properties;
        this.routePolicy = routePolicy;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 25;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        GatewayRoutePolicy.Resolution resolution = routePolicy.resolve(exchange.getRequest());
        if (!resolution.matched()) {
            return chain.filter(exchange);
        }

        ServerHttpRequest request = exchange.getRequest();
        GatewayProperties.Cors cors = properties.cors();
        String origin = request.getHeaders().getOrigin();
        GatewayProperties.Cors.OriginProfile profile = cors.profileFor(origin);
        boolean nativeTransport = cors.nativeAuthTransport().equals(request.getHeaders().getFirst("X-Auth-Transport"));
        boolean hasBusinessCookie = request.getCookies().containsKey(cors.refreshCookieName());

        if (nativeTransport && hasBusinessCookie) {
            return deny(exchange, "native_cookie_forbidden", "Native secure storage transport cannot send browser cookies.");
        }

        if (profile == GatewayProperties.Cors.OriginProfile.OFFICIAL_SITE) {
            if (resolution.rule().authClass() != GatewayRoutePolicy.AuthClass.PUBLIC_READ) {
                return deny(exchange, "official_site_business_session_forbidden", "Official-site requests are limited to named public reads.");
            }
            if (hasBusinessCookie || request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION) != null) {
                return deny(exchange, "official_site_business_token_forbidden", "Official-site requests cannot carry a business session or token.");
            }
            preventSetCookie(exchange);
        }

        if (hasBusinessCookie && UNSAFE_METHODS.contains(request.getMethod())) {
            String sourceFailure = sourceFailure(request, cors, profile, origin);
            if (sourceFailure != null) {
                return deny(exchange, sourceFailure, "The credentialed browser request origin is not trusted.");
            }
        }

        if (nativeTransport) {
            preventSetCookie(exchange);
        }
        return chain.filter(exchange);
    }

    private static String sourceFailure(
            ServerHttpRequest request,
            GatewayProperties.Cors cors,
            GatewayProperties.Cors.OriginProfile profile,
            String origin
    ) {
        String referer = request.getHeaders().getFirst(HttpHeaders.REFERER);
        if (origin != null && !origin.isBlank()) {
            if (!cors.isCredentialedProfile(profile)) {
                return "credentialed_origin_untrusted";
            }
            if (referer != null && !referer.isBlank()) {
                String refererOrigin = originFromReferer(referer);
                if (refererOrigin == null || !origin.equals(refererOrigin)) {
                    return "origin_referer_conflict";
                }
            }
            return null;
        }

        String refererOrigin = originFromReferer(referer);
        if (refererOrigin == null || !cors.isCredentialedProfile(cors.profileFor(refererOrigin))) {
            return "credentialed_referer_untrusted";
        }
        return null;
    }

    private static String originFromReferer(String referer) {
        if (referer == null || referer.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(referer);
            if (uri.getScheme() == null || uri.getHost() == null || uri.getUserInfo() != null
                    || (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme()))) {
                return null;
            }
            String host = uri.getHost().toLowerCase(java.util.Locale.ROOT);
            String scheme = uri.getScheme().toLowerCase(java.util.Locale.ROOT);
            String renderedHost = host.contains(":") ? "[" + host + "]" : host;
            return uri.getPort() < 0 ? scheme + "://" + renderedHost : scheme + "://" + renderedHost + ":" + uri.getPort();
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static void preventSetCookie(ServerWebExchange exchange) {
        exchange.getResponse().beforeCommit(() -> {
            exchange.getResponse().getHeaders().remove(HttpHeaders.SET_COOKIE);
            return Mono.empty();
        });
    }

    private Mono<Void> deny(ServerWebExchange exchange, String reasonCode, String message) {
        GatewayAuditAttributes.setReasonCode(exchange, reasonCode);
        return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                403,
                "forbidden",
                message,
                requestId(exchange),
                traceId(exchange),
                false
        ));
    }

    private String requestId(ServerWebExchange exchange) {
        return CorrelationIds.requestId(
                exchange.getRequest().getHeaders().getFirst("X-Request-Id"),
                properties.requestContext().maxIdLength()
        );
    }

    private String traceId(ServerWebExchange exchange) {
        return CorrelationIds.traceId(
                exchange.getRequest().getHeaders().getFirst("X-Trace-Id"),
                exchange.getRequest().getHeaders().getFirst("traceparent"),
                properties.requestContext().maxIdLength()
        );
    }
}
