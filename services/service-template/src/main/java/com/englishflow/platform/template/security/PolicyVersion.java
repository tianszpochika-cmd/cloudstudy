package com.englishflow.platform.template.security;

import java.time.Instant;
import java.util.Objects;

/** Version and expiry boundary for a signed local policy package or PDP response. */
public record PolicyVersion(String value, Instant expiresAt) {

    public PolicyVersion {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("policy version is required");
        }
        Objects.requireNonNull(expiresAt, "policy expiry is required");
    }

    public boolean isFresh(Instant now) {
        return now != null && now.isBefore(expiresAt);
    }

    public boolean sameAs(PolicyVersion other) {
        return other != null && value.equals(other.value) && expiresAt.equals(other.expiresAt);
    }
}
