package com.englishflow.notification.application;

import java.util.UUID;

public record RequestMetadata(String requestId, String traceId) {

    public RequestMetadata {
        requestId = normalize(requestId, "requestId");
        traceId = normalize(traceId, "traceId");
    }

    public static RequestMetadata generated() {
        return new RequestMetadata("req-" + UUID.randomUUID(), UUID.randomUUID().toString().replace("-", ""));
    }

    private static String normalize(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 128) {
            throw new IllegalArgumentException(field + " is invalid");
        }
        return value.trim();
    }
}
