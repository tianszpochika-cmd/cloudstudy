package com.englishflow.learner.application;

import java.util.UUID;

/** Correlation values propagated from Gateway; neither value is an authority. */
public record RequestMetadata(String requestId, String traceId) {

    public RequestMetadata {
        requestId = normalizeRequest(requestId);
        traceId = normalizeTrace(requestId, traceId);
    }

    public static RequestMetadata none() {
        String id = UUID.randomUUID().toString().replace("-", "");
        return new RequestMetadata("req-" + id, id);
    }

    private static String normalizeRequest(String value) {
        if (value == null || value.isBlank()) {
            return "req-" + UUID.randomUUID().toString().replace("-", "");
        }
        if (!value.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) {
            throw new IllegalArgumentException("requestId has an invalid format");
        }
        return value;
    }

    private static String normalizeTrace(String requestId, String value) {
        if (value == null || value.isBlank()) {
            return requestId.substring(Math.max(0, requestId.length() - 32)).toLowerCase();
        }
        if (!value.matches("[a-f0-9]{32}")) {
            throw new IllegalArgumentException("traceId must be 32 lowercase hex characters");
        }
        return value;
    }
}
