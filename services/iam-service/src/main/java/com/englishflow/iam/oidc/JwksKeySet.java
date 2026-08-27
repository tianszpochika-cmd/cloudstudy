package com.englishflow.iam.oidc;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Immutable JWKS snapshot returned by a provider adapter. */
public record JwksKeySet(String issuer, Instant fetchedAt, List<JwksKeyDescriptor> keys, String etag) {

    public JwksKeySet {
        Objects.requireNonNull(issuer, "issuer");
        Objects.requireNonNull(fetchedAt, "fetchedAt");
        keys = keys == null ? List.of() : List.copyOf(keys);
        if (keys.isEmpty()) {
            throw new IllegalArgumentException("JWKS snapshot must contain at least one signing key");
        }
        Set<String> keyIds = new HashSet<>();
        if (keys.stream().map(JwksKeyDescriptor::keyId).anyMatch(keyId -> !keyIds.add(keyId))) {
            throw new IllegalArgumentException("JWKS snapshot contains duplicate key ids");
        }
        if (etag != null && etag.length() > 256) {
            throw new IllegalArgumentException("etag is too long");
        }
    }
}
