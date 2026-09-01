package com.englishflow.gateway.support;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import org.springframework.http.HttpStatusCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

/**
 * Produces only the redacted boundary-audit shape frozen by the Gateway
 * contract. The configured sink is intentionally replaceable; the local
 * bounded sink is not a durable audit-service implementation.
 */
@Component
public final class SecurityAuditRecorder {

    private final GatewayProperties properties;
    private final GatewayRoutePolicy routePolicy;
    private final SecurityAuditSink sink;

    public SecurityAuditRecorder(
            GatewayProperties properties,
            GatewayRoutePolicy routePolicy,
            SecurityAuditSink sink
    ) {
        this.properties = properties;
        this.routePolicy = routePolicy;
        this.sink = sink;
    }

    public Mono<Void> record(ServerWebExchange exchange, long startedAtNanos) {
        if (!Boolean.TRUE.equals(properties.security().auditEnabled())) {
            return Mono.empty();
        }
        return exchange.getPrincipal()
                .map(SecurityAuditRecorder::principalDetails)
                .defaultIfEmpty(PrincipalDetails.ANONYMOUS)
                .doOnNext(principal -> safelyRecord(exchange, principal, startedAtNanos))
                .then();
    }

    private void safelyRecord(ServerWebExchange exchange, PrincipalDetails principal, long startedAtNanos) {
        try {
            int status = status(exchange);
            GatewayRoutePolicy.Resolution resolution = routePolicy.resolve(exchange.getRequest());
            String routeId = resolution.matched() ? resolution.rule().ruleId() : "unknown";
            sink.record(new SecurityAuditRecord(
                    Instant.now(),
                    bounded(routeId, 128),
                    bounded(method(exchange), 16),
                    status,
                    requestId(exchange),
                    traceId(exchange),
                    principal.subjectHash(),
                    principal.tenantHash(),
                    clientProfile(exchange),
                    decision(status),
                    bounded(GatewayAuditAttributes.reasonCode(exchange, fallbackReason(status)), 128),
                    latencyBucket(startedAtNanos)
            ));
        } catch (RuntimeException ignored) {
            // Boundary audit must never leak request data or replace the caller's
            // already-established security response. Durable audit delivery is a
            // separate M2 runtime concern and is not claimed by this local sink.
        }
    }

    private String requestId(ServerWebExchange exchange) {
        return CorrelationIds.requestId(
                firstNonBlank(
                        exchange.getResponse().getHeaders().getFirst("X-Request-Id"),
                        exchange.getRequest().getHeaders().getFirst("X-Request-Id")
                ),
                properties.requestContext().maxIdLength()
        );
    }

    private String traceId(ServerWebExchange exchange) {
        return CorrelationIds.traceId(
                firstNonBlank(
                        exchange.getResponse().getHeaders().getFirst("X-Trace-Id"),
                        exchange.getRequest().getHeaders().getFirst("X-Trace-Id")
                ),
                exchange.getRequest().getHeaders().getFirst("traceparent"),
                properties.requestContext().maxIdLength()
        );
    }

    private String clientProfile(ServerWebExchange exchange) {
        GatewayProperties.Cors.OriginProfile profile = properties.cors().profileFor(
                exchange.getRequest().getHeaders().getOrigin()
        );
        if (profile != GatewayProperties.Cors.OriginProfile.UNKNOWN) {
            return profile.name();
        }
        if (properties.cors().nativeAuthTransport().equals(
                exchange.getRequest().getHeaders().getFirst("X-Auth-Transport"))) {
            return "NATIVE";
        }
        return "NO_BROWSER_PROFILE";
    }

    private static int status(ServerWebExchange exchange) {
        HttpStatusCode statusCode = exchange.getResponse().getStatusCode();
        // A completed reactive response can intentionally leave the status
        // unset; WebFlux renders that as the successful default 200, not a
        // synthetic Gateway failure.
        return statusCode == null ? 200 : statusCode.value();
    }

    private static String method(ServerWebExchange exchange) {
        return exchange.getRequest().getMethod() == null ? "UNKNOWN" : exchange.getRequest().getMethod().name();
    }

    private static String decision(int status) {
        if (status >= 200 && status < 400) return "ALLOW";
        if (status == 401 || status == 403 || status == 404 || status == 429) return "DENY";
        return "ERROR";
    }

    private static String fallbackReason(int status) {
        return switch (status) {
            case 401 -> "unauthorized";
            case 403 -> "forbidden";
            case 404 -> "not_found";
            case 429 -> "rate_limited";
            case 503 -> "service_unavailable";
            default -> status >= 500 ? "gateway_failure" : "completed";
        };
    }

    private static String latencyBucket(long startedAtNanos) {
        long elapsedMillis = Math.max(0L, (System.nanoTime() - startedAtNanos) / 1_000_000L);
        if (elapsedMillis < 50) return "LT_50_MS";
        if (elapsedMillis < 250) return "50_TO_249_MS";
        if (elapsedMillis < 1_000) return "250_TO_999_MS";
        if (elapsedMillis < 5_000) return "1_TO_4_999_MS";
        return "GTE_5_000_MS";
    }

    private static PrincipalDetails principalDetails(java.security.Principal principal) {
        if (principal instanceof JwtAuthenticationToken jwtAuthentication) {
            String tenant = firstNonBlank(
                    jwtAuthentication.getToken().getClaimAsString("tenant_id"),
                    jwtAuthentication.getToken().getClaimAsString("tenant")
            );
            return new PrincipalDetails(hash(jwtAuthentication.getName()), hash(tenant));
        }
        if (principal instanceof Authentication authentication && authentication.isAuthenticated()) {
            return new PrincipalDetails(hash(authentication.getName()), "");
        }
        return PrincipalDetails.ANONYMOUS;
    }

    private static String firstNonBlank(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }

    private static String hash(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the runtime", exception);
        }
    }

    private static String bounded(String value, int limit) {
        if (value == null) return "";
        return value.length() <= limit ? value : value.substring(0, limit);
    }

    private record PrincipalDetails(String subjectHash, String tenantHash) {
        private static final PrincipalDetails ANONYMOUS = new PrincipalDetails("", "");
    }
}
