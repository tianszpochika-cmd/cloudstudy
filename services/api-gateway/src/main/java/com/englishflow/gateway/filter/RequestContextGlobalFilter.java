package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.support.CorrelationIds;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class RequestContextGlobalFilter implements GlobalFilter, Ordered {

    private final GatewayProperties properties;

    public RequestContextGlobalFilter(GatewayProperties properties) {
        this.properties = properties;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        String requestId = CorrelationIds.requestId(
                exchange.getRequest().getHeaders().getFirst("X-Request-Id"),
                properties.requestContext().maxIdLength());
        String traceId = CorrelationIds.traceId(
                exchange.getRequest().getHeaders().getFirst("X-Trace-Id"),
                exchange.getRequest().getHeaders().getFirst("traceparent"),
                properties.requestContext().maxIdLength());

        var request = exchange.getRequest().mutate()
                .headers(headers -> {
                    headers.set("X-Request-Id", requestId);
                    headers.set("X-Trace-Id", traceId);
                    // Do not forward a client-controlled W3C parent. The OTel
                    // instrumentation creates the downstream context after the
                    // Gateway has established the bounded correlation IDs.
                    headers.remove("traceparent");
                    headers.remove("tracestate");
                })
                .build();
        var response = exchange.getResponse();
        response.getHeaders().set("X-Request-Id", requestId);
        response.getHeaders().set("X-Trace-Id", traceId);

        return chain.filter(exchange.mutate().request(request).build());
    }
}
