package com.englishflow.adminops.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

final class AdminOpsHttpSupport {

    private AdminOpsHttpSupport() {
    }

    static String requestId(HttpServletRequest request) {
        String value = request.getHeader("X-Request-Id");
        return value == null || value.isBlank() ? "req_admin_" + UUID.randomUUID() : value.trim();
    }

    static String traceId(HttpServletRequest request) {
        String value = request.getHeader("X-Trace-Id");
        return value == null || value.isBlank() ? "trace_admin_" + UUID.randomUUID() : value.trim();
    }

    static Map<String, Object> envelope(Object data, HttpServletRequest request) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestId", requestId(request));
        result.put("data", data);
        result.put("meta", Map.of("service", "admin-ops-service", "schemaVersion", "admin-ops.api.v1"));
        return result;
    }
}
