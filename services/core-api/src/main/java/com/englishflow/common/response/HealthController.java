package com.englishflow.common.response;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    private final String applicationVersion;

    public HealthController(
            @Value("${info.app.version:1.0.0}") String applicationVersion
    ) {
        this.applicationVersion = applicationVersion;
    }

    @GetMapping("/health")
    public ApiHealthResponse health(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Trace-Id", required = false) String traceId
    ) {
        String finalRequestId = normalizeRequestId(requestId);
        String finalTraceId = normalizeTraceId(traceId);
        OffsetDateTime serverTime = OffsetDateTime.now(ZoneOffset.UTC);
        return new ApiHealthResponse(
                finalRequestId,
                new ApiHealthResponse.HealthData("UP", "core-api", applicationVersion, "dev", List.of()),
                new ApiHealthResponse.ApiMeta("v1", "1.0.0", serverTime, finalTraceId)
        );
    }

    private static String normalizeRequestId(String requestId) {
        if (requestId != null && requestId.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) return requestId;
        return "req_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    private static String normalizeTraceId(String traceId) {
        if (traceId != null && traceId.matches("[a-f0-9]{32}")) return traceId;
        return UUID.randomUUID().toString().replace("-", "") + "00000000";
    }
}
