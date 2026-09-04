package com.englishflow.gateway.web;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.support.CorrelationIds;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Local Gateway health projection for the canonical GATEWAY_LOCAL rule.
 *
 * <p>This endpoint intentionally reports only the Gateway process and does
 * not proxy core-api. The wire identity therefore stays aligned with the
 * canonical route owner ({@code api-gateway}); owner-service or dependency
 * health is not inferred here.</p>
 */
@RestController
public final class GatewayHealthController {

    private static final String API_VERSION = "v1";
    private static final String SCHEMA_VERSION = "1.0.0";

    private final GatewayProperties properties;

    public GatewayHealthController(GatewayProperties properties) {
        this.properties = properties;
    }

    @GetMapping(path = "/internal/gateway/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> health(ServerHttpRequest request) {
        String requestId = CorrelationIds.requestId(
                request.getHeaders().getFirst("X-Request-Id"),
                properties.requestContext().maxIdLength()
        );
        String traceId = CorrelationIds.traceId(
                request.getHeaders().getFirst("X-Trace-Id"),
                request.getHeaders().getFirst("traceparent"),
                properties.requestContext().maxIdLength()
        );
        Map<String, Object> body = Map.of(
                "data", Map.of(
                        "status", "UP",
                        "service", "api-gateway",
                        "version", SCHEMA_VERSION,
                        "build", "p1r-m2-001-boundary",
                        "dependencies", List.of()
                ),
                "meta", Map.of(
                        "requestId", requestId,
                        "traceId", traceId,
                        "apiVersion", API_VERSION,
                        "schemaVersion", SCHEMA_VERSION,
                        "serverTime", Instant.now().toString()
                )
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setCacheControl("no-store");
        headers.set("X-Request-Id", requestId);
        headers.set("X-Trace-Id", traceId);
        headers.set("X-API-Version", API_VERSION);
        return new ResponseEntity<>(body, headers, HttpStatus.OK);
    }
}
