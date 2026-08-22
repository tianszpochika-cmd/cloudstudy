package com.englishflow.gateway.filter;

import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayError;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class ApiVersionBoundaryGlobalFilter implements GlobalFilter, Ordered {

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        boolean externalApi = path.equals("/api") || path.startsWith("/api/");
        boolean supportedVersion = path.equals("/api/v1") || path.startsWith("/api/v1/");
        boolean internalRoute = path.equals("/internal") || path.startsWith("/internal/");

        if ((externalApi && !supportedVersion) || internalRoute) {
            String requestId = header(exchange, "X-Request-Id");
            String traceId = header(exchange, "X-Trace-Id");
            return GatewayErrorResponseWriter.write(exchange, new GatewayError(
                    404,
                    internalRoute ? "internal_route_not_public" : "unsupported_api_version",
                    internalRoute ? "Internal routes are not public." : "The API version is not supported.",
                    requestId,
                    traceId
            ));
        }
        return chain.filter(exchange);
    }

    private static String header(ServerWebExchange exchange, String name) {
        String value = exchange.getRequest().getHeaders().getFirst(name);
        return value == null || value.isBlank() ? CorrelationIds.requestId(null, 128) : value;
    }
}
