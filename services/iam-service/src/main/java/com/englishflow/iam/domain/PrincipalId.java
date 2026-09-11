package com.englishflow.iam.domain;

import java.util.Objects;
import java.util.UUID;

/** Platform-owned immutable principal identifier. */
public record PrincipalId(UUID value) {

    private static final UUID UNRESOLVED_VALUE = new UUID(0L, 0L);

    public PrincipalId {
        Objects.requireNonNull(value, "value");
    }

    public static PrincipalId random() {
        return new PrincipalId(UUID.randomUUID());
    }

    /**
     * Audit-only sentinel for an attempt that cannot be bound to a platform principal (for
     * example a password-reset request for an unknown identifier). Never a real account.
     */
    public static PrincipalId unresolved() {
        return new PrincipalId(UNRESOLVED_VALUE);
    }

    public boolean isUnresolved() {
        return UNRESOLVED_VALUE.equals(value);
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
