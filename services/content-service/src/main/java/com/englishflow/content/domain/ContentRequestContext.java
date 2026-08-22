package com.englishflow.content.domain;

import java.util.UUID;
import java.util.regex.Pattern;

/** Correlation facts copied into an outbox envelope; never used as an authorization fact. */
public record ContentRequestContext(String requestId, String traceId) {

    private static final Pattern REQUEST = Pattern.compile("[A-Za-z][A-Za-z0-9._-]{7,127}");
    private static final Pattern TRACE = Pattern.compile("[a-f0-9]{32}");

    public ContentRequestContext {
        requestId = normalize(requestId, "requestId", REQUEST);
        traceId = normalize(traceId, "traceId", TRACE);
    }

    public static ContentRequestContext local() {
        String id = UUID.randomUUID().toString().replace("-", "");
        return new ContentRequestContext("local-" + id, id);
    }

    private static String normalize(String value, String field, Pattern pattern) {
        if (value == null || value.isBlank() || !pattern.matcher(value).matches()) {
            throw ContentOperationException.badRequest("CORRELATION_INVALID", field + " has an unsafe format");
        }
        return value;
    }
}
