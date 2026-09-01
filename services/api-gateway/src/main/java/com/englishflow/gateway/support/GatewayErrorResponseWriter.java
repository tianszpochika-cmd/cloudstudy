package com.englishflow.gateway.support;

import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

public final class GatewayErrorResponseWriter {

    private static final String API_VERSION = "v1";
    private static final String SCHEMA_VERSION = "1.0.0";

    private GatewayErrorResponseWriter() {
    }

    public static Mono<Void> write(ServerWebExchange exchange, GatewayError error) {
        if (exchange.getResponse().isCommitted()) {
            return Mono.error(new IllegalStateException("gateway response is already committed"));
        }

        exchange.getAttributes().putIfAbsent(GatewayAuditAttributes.REASON_CODE, error.code());
        exchange.getResponse().setStatusCode(HttpStatusCode.valueOf(error.status()));
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        exchange.getResponse().getHeaders().setCacheControl("no-store");
        exchange.getResponse().getHeaders().set("X-Request-Id", error.requestId());
        exchange.getResponse().getHeaders().set("X-Trace-Id", error.traceId());
        exchange.getResponse().getHeaders().set("X-API-Version", API_VERSION);
        if (error.status() == 401) {
            exchange.getResponse().getHeaders().set("WWW-Authenticate", "Bearer");
        }
        if ((error.status() == 429 || error.status() == 503)
                && exchange.getResponse().getHeaders().getFirst("Retry-After") == null) {
            // Rate limiting may already provide its precise reset-derived value.
            // For every other temporary failure retain the canonical header with
            // a bounded conservative retry hint rather than omitting it.
            exchange.getResponse().getHeaders().set("Retry-After", "1");
        }

        byte[] bytes = json(error).getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(bytes);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    private static String json(GatewayError error) {
        return "{\"error\":{\"errorCode\":\"" + canonicalErrorCode(error.status())
                + "\",\"message\":\"" + escape(error.message())
                + "\",\"retryable\":" + error.retryable()
                + "},\"meta\":{\"requestId\":\"" + escape(error.requestId())
                + "\",\"traceId\":\"" + escape(error.traceId())
                + "\",\"apiVersion\":\"" + API_VERSION
                + "\",\"schemaVersion\":\"" + SCHEMA_VERSION
                + "\",\"serverTime\":\"" + Instant.now() + "\"}}";
    }

    /**
     * The internal reason code remains deliberately more specific for the bounded
     * audit record.  The external envelope must instead use the frozen OpenAPI
     * ErrorCode enum, so route topology and dependency detail cannot leak.
     */
    private static String canonicalErrorCode(int status) {
        return switch (status) {
            case 400, 413 -> "VALIDATION_ERROR";
            case 401 -> "AUTH_REQUIRED";
            case 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            case 409 -> "CONFLICT";
            case 429 -> "RATE_LIMITED";
            case 500 -> "INTERNAL_ERROR";
            default -> "SERVICE_UNAVAILABLE";
        };
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder escaped = new StringBuilder(value.length() + 16);
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '\\' -> escaped.append("\\\\");
                case '"' -> escaped.append("\\\"");
                case '\b' -> escaped.append("\\b");
                case '\f' -> escaped.append("\\f");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (character < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) character));
                    } else {
                        escaped.append(character);
                    }
                }
            }
        }
        return escaped.toString();
    }
}
