package com.englishflow.content.domain;

import java.util.Objects;
import java.util.regex.Pattern;

/** Stable command key; durable uniqueness belongs to the content-service schema. */
public record ContentIdempotencyKey(String value) {

    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{15,127}");

    public ContentIdempotencyKey {
        Objects.requireNonNull(value, "idempotency key is required");
        if (!SAFE.matcher(value).matches()) {
            throw ContentOperationException.badRequest(
                    "IDEMPOTENCY_KEY_INVALID", "Idempotency-Key must contain 16-128 safe characters");
        }
    }
}
