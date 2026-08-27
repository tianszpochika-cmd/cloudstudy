package com.englishflow.gateway.filter;

import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayErrorMapper;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class GatewayErrorHandlingGlobalFilter implements GlobalFilter, Ordered {

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        return chain.filter(exchange)
                .onErrorResume(failure -> {
                    if (exchange.getResponse().isCommitted()) {
                        return Mono.error(failure);
                    }
                    String requestId = requestId(exchange);
                    String traceId = traceId(exchange);
                    return GatewayErrorResponseWriter.write(
                            exchange,
                            GatewayErrorMapper.map(failure, requestId, traceId)
                    );
                });
    }

    private static String requestId(ServerWebExchange exchange) {
        return CorrelationIds.requestId(
                exchange.getRequest().getHeaders().getFirst("X-Request-Id"), 128);
    }

    private static String traceId(ServerWebExchange exchange) {
        return CorrelationIds.traceId(
                exchange.getRequest().getHeaders().getFirst("X-Trace-Id"),
                exchange.getRequest().getHeaders().getFirst("traceparent"),
                128);
    }
}
