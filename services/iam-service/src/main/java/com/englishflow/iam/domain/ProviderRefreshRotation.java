package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/** Provider-issued rotation result; this service does not mint either token. */
public record ProviderRefreshRotation(
        ProviderSessionReference providerSessionReference,
        String nextRefreshToken,
        Instant accessTokenExpiresAt,
        String nextAccessToken) {

    public ProviderRefreshRotation(
            ProviderSessionReference providerSessionReference,
            String nextRefreshToken,
            Instant accessTokenExpiresAt) {
        this(providerSessionReference, nextRefreshToken, accessTokenExpiresAt, null);
    }

    public ProviderRefreshRotation {
        Objects.requireNonNull(providerSessionReference, "providerSessionReference");
        Objects.requireNonNull(nextRefreshToken, "nextRefreshToken");
        if (nextRefreshToken.isBlank() || nextRefreshToken.length() > 8192
                || nextRefreshToken.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("provider refresh token is invalid");
        }
        Objects.requireNonNull(accessTokenExpiresAt, "accessTokenExpiresAt");
        if (nextAccessToken != null && (nextAccessToken.isBlank() || nextAccessToken.length() > 16384
                || nextAccessToken.chars().anyMatch(Character::isISOControl))) {
            throw new IllegalArgumentException("provider access token is invalid");
        }
    }
}
