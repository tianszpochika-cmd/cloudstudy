package com.englishflow.platform.template.security;

import java.time.Instant;
import java.util.Objects;

/** Version, monotonic revision and expiry boundary for a signed policy package or PDP response. */
public record PolicyVersion(String value, long revision, Instant expiresAt) {

    /**
     * Compatibility constructor for early policy packages. New policy publishers should use an
     * explicit non-negative revision so a delayed/rolled-back package cannot replace a newer one.
     */
    public PolicyVersion(String value, Instant expiresAt) {
        this(value, deriveRevision(value), expiresAt);
    }

    public PolicyVersion {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("policy version is required");
        }
        if (revision < 0) {
            throw new IllegalArgumentException("policy revision cannot be negative");
        }
        Objects.requireNonNull(expiresAt, "policy expiry is required");
    }

    public boolean isFresh(Instant now) {
        return now != null && now.isBefore(expiresAt);
    }

    public boolean sameAs(PolicyVersion other) {
        return other != null
                && value.equals(other.value)
                && revision == other.revision
                && expiresAt.equals(other.expiresAt);
    }

    /**
     * Returns whether this version is not older than {@code other}. Equal revisions with
     * different opaque values are deliberately incomparable and therefore rejected.
     */
    public boolean isAtLeast(PolicyVersion other) {
        if (other == null) {
            return true;
        }
        if (revision != other.revision) {
            return revision > other.revision;
        }
        return value.equals(other.value);
    }

    public boolean isOlderThan(PolicyVersion other) {
        return other != null && !isAtLeast(other);
    }

    private static long deriveRevision(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        int separator = value.lastIndexOf('-');
        if (separator < 0 || separator == value.length() - 1) {
            return 0;
        }
        String suffix = value.substring(separator + 1);
        try {
            return Long.parseLong(suffix);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }
}
