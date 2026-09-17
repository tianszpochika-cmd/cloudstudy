package com.englishflow.gateway.filter;

import com.englishflow.gateway.config.GatewayProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.web.server.ServerWebExchange;

/**
 * Lets a browser read gateway edge denials instead of masking them as CORS
 * noise. Denials still deny; for a known browser origin this only echoes that
 * exact origin back with {@code Vary: Origin} so the true status and error
 * envelope become visible in devtools. Unknown origins and non-browser calls
 * are untouched: no header is added for them.
 */
public final class CorsDenyHeaders {

    private CorsDenyHeaders() {
    }

    public static void addIfKnownOrigin(ServerWebExchange exchange, GatewayProperties properties) {
        String origin = exchange.getRequest().getHeaders().getOrigin();
        if (origin == null || origin.isBlank()) {
            return;
        }
        if (properties.cors().profileFor(origin) == GatewayProperties.Cors.OriginProfile.UNKNOWN) {
            return;
        }
        exchange.getResponse().getHeaders().set(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, origin);
        exchange.getResponse().getHeaders().add(HttpHeaders.VARY, HttpHeaders.ORIGIN);
    }
}
