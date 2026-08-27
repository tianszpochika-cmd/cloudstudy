package com.englishflow.iam.oidc;

import java.time.Instant;
import java.util.Objects;

/**
 * Age information produced only after the provider adapter verifies an ID-token claim against
 * the issuer and JWKS. A browser-provided age is never represented by this type.
 */
public record TrustedIdpAgeClaim(int age, String claimName, Instant verifiedAt) {

    public TrustedIdpAgeClaim {
        if (age < 0 || age > 150) {
            throw new IllegalArgumentException("age is outside the supported range");
        }
        Objects.requireNonNull(claimName, "claimName");
        if (claimName.isBlank() || claimName.length() > 64
                || claimName.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("claimName is invalid");
        }
        Objects.requireNonNull(verifiedAt, "verifiedAt");
    }
}
