package com.englishflow.iam.oidc;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Immutable JWKS snapshot returned by a provider adapter. */
public record JwksKeySet(String issuer, Instant fetchedAt, List<JwksKeyDescriptor> keys, String etag) {

    public JwksKeySet {
        Objects.requireNonNull(issuer, "issuer");
        Objects.requireNonNull(fetchedAt, "fetchedAt");
        keys = keys == null ? List.of() : List.copyOf(keys);
        if (etag != null && etag.length() > 256) {
            throw new IllegalArgumentException("etag is too long");
        }
    }
}
