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

        byte[] bytes = json(error).getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(bytes);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    private static String json(GatewayError error) {
        return "{\"error\":{\"code\":\"" + escape(error.code())
                + "\",\"message\":\"" + escape(error.message())
                + "\"},\"requestId\":\"" + escape(error.requestId())
                + "\",\"traceId\":\"" + escape(error.traceId()) + "\"}";
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
