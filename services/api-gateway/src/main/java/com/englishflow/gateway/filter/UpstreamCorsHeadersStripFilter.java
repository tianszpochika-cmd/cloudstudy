package com.englishflow.gateway.filter;

import org.springframework.cloud.gateway.filter.headers.HttpHeadersFilter;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import java.util.Locale;

/**
 * The gateway is the single CORS authority for browser origins. Upstream owners (e.g. IAM, which
 * also serves direct TLS browser posts) may emit their own Access-Control-* headers; forwarding them
 * would duplicate Access-Control-Allow-Origin and browsers reject the response.
 */
@Component
public class UpstreamCorsHeadersStripFilter implements HttpHeadersFilter {

    @Override
    public HttpHeaders filter(HttpHeaders input, ServerWebExchange exchange) {
        HttpHeaders filtered = new HttpHeaders();
        input.forEach((name, values) -> {
            if (!name.toLowerCase(Locale.ROOT).startsWith("access-control-")) {
                filtered.addAll(name, values);
            }
        });
        return filtered;
    }

    @Override
    public boolean supports(Type type) {
        return type == Type.RESPONSE;
    }
}
