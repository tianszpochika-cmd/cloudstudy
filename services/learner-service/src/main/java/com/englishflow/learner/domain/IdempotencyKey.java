package com.englishflow.learner.domain;

import java.util.Objects;
import java.util.regex.Pattern;

/** Client write key. Durable uniqueness is enforced by the learner-owned store. */
public record IdempotencyKey(String value) {

    private static final Pattern SAFE_KEY = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{15,127}");
    private static final Pattern SAFE_OPERATION = Pattern.compile("[a-z][a-z0-9._:-]{0,63}");

    public IdempotencyKey {
        Objects.requireNonNull(value, "idempotency key is required");
        if (!SAFE_KEY.matcher(value).matches()) {
            throw new IllegalArgumentException("Idempotency-Key must contain 16-128 safe characters");
        }
    }

    public String namespaced(LearnerTenantScope scope, String operation) {
        Objects.requireNonNull(scope, "scope is required");
        if (operation == null || !SAFE_OPERATION.matcher(operation).matches()) {
            throw new IllegalArgumentException("operation has an unsafe format");
        }
        return scope.tenantId() + ":" + scope.subjectId() + ":" + operation + ":" + value;
    }
}
