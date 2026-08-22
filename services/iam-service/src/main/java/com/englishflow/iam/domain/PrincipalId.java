package com.englishflow.iam.domain;

import java.util.Objects;
import java.util.UUID;

/** Platform-owned immutable principal identifier. */
public record PrincipalId(UUID value) {

    public PrincipalId {
        Objects.requireNonNull(value, "value");
    }

    public static PrincipalId random() {
        return new PrincipalId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
