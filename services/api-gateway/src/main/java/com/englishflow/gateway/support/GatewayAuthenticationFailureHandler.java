package com.englishflow.gateway.support;

import com.englishflow.gateway.config.GatewayProperties;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.server.ServerAuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Writes one redacted response for both missing credentials and failures raised
 * by the Resource Server while parsing, verifying or validating a bearer JWT.
 * AuthenticationException messages may contain token or decoder diagnostics,
 * so they are intentionally never copied to the client or audit record.
 */
@Component
public final class GatewayAuthenticationFailureHandler implements ServerAuthenticationEntryPoint {

    private final GatewayProperties properties;
    private final SecurityAuditRecorder auditRecorder;

    public GatewayAuthenticationFailureHandler(
            GatewayProperties properties,
            SecurityAuditRecorder auditRecorder
    ) {
        this.properties = properties;
        this.auditRecorder = auditRecorder;
    }

    @Override
    public Mono<Void> commence(ServerWebExchange exchange, AuthenticationException ignored) {
        long startedAtNanos = System.nanoTime();
        // Keep this stable and non-diagnostic: SecurityAuditRecord deliberately
        // has no token/error-detail fields, and no raw decoder detail reaches it.
        GatewayAuditAttributes.setReasonCode(exchange, "unauthorized");
        return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                        401,
                        "unauthorized",
                        "Authentication is required.",
                        requestId(exchange),
                        traceId(exchange)
                ))
                .then(auditRecorder.record(exchange, startedAtNanos));
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
