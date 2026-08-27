package com.englishflow.gateway.support;

import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

public final class GatewayErrorResponseWriter {

    private GatewayErrorResponseWriter() {
    }

    public static Mono<Void> write(ServerWebExchange exchange, GatewayError error) {
        if (exchange.getResponse().isCommitted()) {
            return Mono.error(new IllegalStateException("gateway response is already committed"));
        }

        exchange.getResponse().setStatusCode(HttpStatusCode.valueOf(error.status()));
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        exchange.getResponse().getHeaders().setCacheControl("no-store");
        exchange.getResponse().getHeaders().set("X-Request-Id", error.requestId());
        exchange.getResponse().getHeaders().set("X-Trace-Id", error.traceId());
        if (error.status() == 401) {
            exchange.getResponse().getHeaders().set("WWW-Authenticate", "Bearer");
        }

        byte[] bytes = json(error).getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(bytes);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    private static String json(GatewayError error) {
        return "{\"error\":{\"code\":\"" + escape(error.code())
                + "\",\"message\":\"" + escape(error.message())
                + "\",\"retryable\":" + error.retryable()
                + "},\"requestId\":\"" + escape(error.requestId())
                + "\",\"traceId\":\"" + escape(error.traceId()) + "\"}";
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
