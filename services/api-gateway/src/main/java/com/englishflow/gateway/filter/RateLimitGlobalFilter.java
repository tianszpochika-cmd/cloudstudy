package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import com.englishflow.gateway.rate.RateLimitBackend;
import com.englishflow.gateway.rate.RateLimitBackendUnavailableException;
import com.englishflow.gateway.rate.RateLimitDecision;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayAuditAttributes;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferLimitException;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpRequestDecorator;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/**
 * Enforces the canonical auth-class admission matrix before a request reaches
 * an upstream route. The non-local default is Redis and a backend error always
 * fails closed; the memory backend remains a deliberately local/test-only
 * substitute selected by the local profile.
 */
@Component
public final class RateLimitGlobalFilter implements GlobalFilter, Ordered {

    private static final int MAX_ADMISSION_JSON_BYTES = 16 * 1024;

    private final GatewayProperties properties;
    private final GatewayRoutePolicy routePolicy;
    private final RateLimitBackend backend;
    private final ObjectMapper objectMapper;

    public RateLimitGlobalFilter(
            GatewayProperties properties,
            GatewayRoutePolicy routePolicy,
            RateLimitBackend backend,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.routePolicy = routePolicy;
        this.backend = backend;
        this.objectMapper = objectMapper;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 30;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        GatewayRoutePolicy.Resolution resolution = routePolicy.resolve(exchange.getRequest());
        if (!resolution.matched()) {
            // The security chain retains the default deny decision. Rate limit
            // only named canonical Gateway routes, never arbitrary fallthrough.
            return chain.filter(exchange);
        }

        GatewayProperties.RateLimitPolicy policy = properties.rateLimit().policyFor(resolution.rule().authClass());
        var responseHeaders = exchange.getResponse().getHeaders();
        responseHeaders.set("X-RateLimit-Policy", resolution.rule().authClass().rateLimitPolicyKey());
        responseHeaders.set("X-RateLimit-Limit", Integer.toString(policy.requestsPerWindow()));

        if (!Boolean.TRUE.equals(properties.rateLimit().enabled())) {
            return chain.filter(exchange);
        }

        return admissionContext(exchange, resolution.rule())
                .flatMap(context -> decision(context, resolution.rule(), policy)
                        .flatMap(decision -> respondForDecision(context.exchange(), decision, chain)))
                .onErrorResume(AdmissionBodyTooLargeException.class, ignored -> {
                    GatewayAuditAttributes.setReasonCode(exchange, "admission_body_too_large");
                    return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                            HttpStatus.PAYLOAD_TOO_LARGE.value(),
                            "admission_body_too_large",
                            "The authentication admission payload is too large.",
                            requestId(exchange),
                            traceId(exchange)
                    ));
                })
            .onErrorResume(RateLimitBackendUnavailableException.class, ignored -> {
                responseHeaders.set("X-RateLimit-Backend", "unavailable");
                GatewayAuditAttributes.setReasonCode(exchange, "rate_limit_backend_unavailable");
                return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                        HttpStatus.SERVICE_UNAVAILABLE.value(),
                        "rate_limit_backend_unavailable",
                        "The rate-limit backend is unavailable.",
                            requestId(exchange),
                            traceId(exchange),
                            true
                    ));
                });
    }

    private Mono<Void> respondForDecision(
            ServerWebExchange exchange,
            RateLimitDecision decision,
            GatewayFilterChain chain
    ) {
        applyHeaders(exchange.getResponse().getHeaders(), decision);
        if (decision.allowed()) {
            return chain.filter(exchange);
        }
        exchange.getResponse().getHeaders().set("Retry-After", Long.toString(secondsUntilReset(decision)));
        GatewayAuditAttributes.setReasonCode(exchange, "rate_limited");
        return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                "rate_limited",
                "Too many requests.",
                requestId(exchange),
                traceId(exchange),
                true
        ));
    }

    private Mono<RateLimitDecision> decision(
            AdmissionContext context,
            GatewayRoutePolicy.Rule rule,
            GatewayProperties.RateLimitPolicy policy
    ) {
        return admissionKeys(context, rule)
                .flatMap(keys -> consumeSequentially(keys, policy, 0))
                .onErrorMap(failure -> failure instanceof RateLimitBackendUnavailableException
                        ? failure
                        : new RateLimitBackendUnavailableException(failure));
    }

    private Mono<RateLimitDecision> consumeSequentially(
            List<String> keys,
            GatewayProperties.RateLimitPolicy policy,
            int index
    ) {
        return backend.consume(keys.get(index), policy)
                // Lettuce may keep a disconnected command pending while it
                // reconnects. Bound every budget consume independently so the
                // Gateway can fail closed instead of inheriting that retry time.
                .timeout(properties.rateLimit().backendTimeout())
                .flatMap(decision -> decision.allowed() && index + 1 < keys.size()
                        ? consumeSequentially(keys, policy, index + 1)
                        : Mono.just(decision));
    }

    private Mono<List<String>> admissionKeys(AdmissionContext context, GatewayRoutePolicy.Rule rule) {
        return key(context, rule).map(compositeKey -> requiresIpTotalBudget(rule.authClass())
                ? List.of(ipTotalKey(context, rule), compositeKey)
                : List.of(compositeKey));
    }

    private Mono<String> key(AdmissionContext context, GatewayRoutePolicy.Rule rule) {
        String route = digest(rule.ruleId());
        String ip = digest(remoteAddress(context.exchange()));
        String device = digest(context.device());
        return switch (rule.authClass()) {
            case PUBLIC_READ -> Mono.just("ip-route:" + ip + ":" + route);
            case AUTH_REGISTER, AUTH_LOGIN, PASSWORD_RESET -> Mono.just(
                    "ip-device-account:" + ip + ":" + device + ":" + digest(context.account()));
            case AUTH_REFRESH -> Mono.just(
                    "ip-device-session:" + ip + ":" + device + ":" + digest(context.session()));
            case AUTHENTICATED_READ -> context.exchange().getPrincipal()
                    .map(principal -> "subject-route:" + digest(principal.getName()) + ":" + route)
                    .defaultIfEmpty("subject-route:unauthenticated:" + route);
            case AUTHENTICATED_WRITE -> context.exchange().getPrincipal()
                    .map(principal -> "subject-device-route:" + digest(principal.getName()) + ":" + device + ":" + route)
                    .defaultIfEmpty("subject-device-route:unauthenticated:" + device + ":" + route);
            case HIGH_RISK_ADMIN -> context.exchange().getPrincipal()
                    .map(principal -> "subject-device-tenant-route:" + digest(principal.getName()) + ":" + device
                            + ":" + digest(verifiedTenant(principal)) + ":" + route)
                    .defaultIfEmpty("subject-device-tenant-route:unauthenticated:" + device + ":none:" + route);
            // The provider is derived only from the canonical callback rule;
            // commerce-service owns real signature verification. This Gateway
            // bucket is not evidence that signature verification ran and stays
            // NOT_RUNTIME_VERIFIED until that owner is exercised in runtime.
            case PROVIDER_CALLBACK -> Mono.just("provider-route:"
                    + digest(rule.providerId()) + ":" + route);
        };
    }

    private static boolean requiresIpTotalBudget(GatewayRoutePolicy.AuthClass authClass) {
        return authClass == GatewayRoutePolicy.AuthClass.AUTH_REGISTER
                || authClass == GatewayRoutePolicy.AuthClass.AUTH_LOGIN
                || authClass == GatewayRoutePolicy.AuthClass.PASSWORD_RESET;
    }

    private static String ipTotalKey(AdmissionContext context, GatewayRoutePolicy.Rule rule) {
        // This deliberately excludes mutable device/account values. It is a
        // second budget beside the canonical composite key, so rotating either
        // value cannot bypass the admission limit for this sensitive class.
        return "ip-auth-admission:" + digest(remoteAddress(context.exchange())) + ":"
                + rule.authClass().rateLimitPolicyKey();
    }

    private Mono<AdmissionContext> admissionContext(ServerWebExchange exchange, GatewayRoutePolicy.Rule rule) {
        if (!requiresJsonAdmissionFacts(rule.authClass())) {
            return Mono.just(new AdmissionContext(exchange, "", deviceHeader(exchange), sessionFromCookie(exchange)));
        }
        long contentLength = exchange.getRequest().getHeaders().getContentLength();
        if (contentLength > MAX_ADMISSION_JSON_BYTES) {
            return Mono.error(new AdmissionBodyTooLargeException());
        }
        MediaType contentType = exchange.getRequest().getHeaders().getContentType();
        if (contentType == null || !MediaType.APPLICATION_JSON.isCompatibleWith(contentType)) {
            return Mono.just(new AdmissionContext(exchange, "", deviceHeader(exchange), sessionFromCookie(exchange)));
        }

        return DataBufferUtils.join(exchange.getRequest().getBody(), MAX_ADMISSION_JSON_BYTES)
                .map(buffer -> fromJsonBody(exchange, buffer))
                .defaultIfEmpty(new AdmissionContext(exchange, "", deviceHeader(exchange), sessionFromCookie(exchange)))
                .onErrorMap(DataBufferLimitException.class, ignored -> new AdmissionBodyTooLargeException());
    }

    private AdmissionContext fromJsonBody(ServerWebExchange exchange, DataBuffer buffer) {
        byte[] bytes = new byte[buffer.readableByteCount()];
        try {
            buffer.read(bytes);
        } finally {
            DataBufferUtils.release(buffer);
        }

        String account = "";
        String device = deviceHeader(exchange);
        String session = sessionFromCookie(exchange);
        try {
            JsonNode root = objectMapper.readTree(bytes);
            account = boundedText(root.path("identifier"));
            if (device.isBlank()) {
                device = firstNonBlank(
                        boundedText(root.path("device").path("deviceId")),
                        boundedText(root.path("deviceId")),
                        boundedText(root.path("device").path("deviceType"))
                                + ":" + boundedText(root.path("device").path("clientVersion"))
                );
            }
            session = firstNonBlank(session, boundedText(root.path("refreshToken")));
        } catch (Exception ignored) {
            // IAM owns request-schema validation. Parsing here is only for a
            // bounded, hashed admission key and never logs the payload.
        }
        return new AdmissionContext(replayBody(exchange, bytes), account, device, session);
    }

    private static boolean requiresJsonAdmissionFacts(GatewayRoutePolicy.AuthClass authClass) {
        return authClass == GatewayRoutePolicy.AuthClass.AUTH_REGISTER
                || authClass == GatewayRoutePolicy.AuthClass.AUTH_LOGIN
                || authClass == GatewayRoutePolicy.AuthClass.AUTH_REFRESH
                || authClass == GatewayRoutePolicy.AuthClass.PASSWORD_RESET;
    }

    private static ServerWebExchange replayBody(ServerWebExchange exchange, byte[] bytes) {
        ServerHttpRequest decorated = new ServerHttpRequestDecorator(exchange.getRequest()) {
            @Override
            public HttpHeaders getHeaders() {
                HttpHeaders headers = new HttpHeaders();
                headers.putAll(super.getHeaders());
                headers.setContentLength(bytes.length);
                return headers;
            }

            @Override
            public Flux<DataBuffer> getBody() {
                return Flux.defer(() -> Flux.just(exchange.getResponse().bufferFactory().wrap(bytes)));
            }
        };
        return exchange.mutate().request(decorated).build();
    }

    private String deviceHeader(ServerWebExchange exchange) {
        return firstNonBlank(exchange.getRequest().getHeaders().getFirst("X-Device-Id"), "");
    }

    private String sessionFromCookie(ServerWebExchange exchange) {
        var cookie = exchange.getRequest().getCookies().getFirst(properties.cors().refreshCookieName());
        return cookie == null ? "" : cookie.getValue();
    }

    private static String verifiedTenant(java.security.Principal principal) {
        if (principal instanceof JwtAuthenticationToken jwt) {
            return firstNonBlank(jwt.getToken().getClaimAsString("tenant_id"), jwt.getToken().getClaimAsString("tenant"));
        }
        return "";
    }

    private static String remoteAddress(ServerWebExchange exchange) {
        InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
        if (remoteAddress == null || remoteAddress.getAddress() == null) {
            return "unknown";
        }
        return remoteAddress.getAddress().getHostAddress();
    }

    private static void applyHeaders(HttpHeaders headers, RateLimitDecision decision) {
        headers.set("X-RateLimit-Remaining", Long.toString(decision.remaining()));
        headers.set("X-RateLimit-Reset", Long.toString(decision.resetEpochSecond()));
    }

    private static long secondsUntilReset(RateLimitDecision decision) {
        return Math.max(1L, decision.resetEpochSecond() - (System.currentTimeMillis() / 1000L));
    }

    private static String boundedText(JsonNode node) {
        if (node == null || !node.isTextual()) return "";
        String value = node.asText();
        return value.length() <= 512 ? value : value.substring(0, 512);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }

    private static String digest(String value) {
        String safe = value == null ? "" : value;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(safe.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the runtime", exception);
        }
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

    private record AdmissionContext(ServerWebExchange exchange, String account, String device, String session) {
    }

    private static final class AdmissionBodyTooLargeException extends RuntimeException {
    }
}
