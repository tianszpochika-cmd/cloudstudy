package com.englishflow.iam.oidc;

import java.net.URI;
import java.util.Objects;

/** Data passed from the client flow to an external provider adapter. */
public record AuthorizationCodeExchange(
        String providerId,
        String authorizationCode,
        URI redirectUri,
        String codeVerifier) {

    public AuthorizationCodeExchange {
        require(providerId, "providerId", 64);
        require(authorizationCode, "authorizationCode", 4096);
        Objects.requireNonNull(redirectUri, "redirectUri");
        require(codeVerifier, "codeVerifier", 128);
    }

    private static void require(String value, String name, int maxLength) {
        Objects.requireNonNull(value, name);
        if (value.isBlank() || value.length() > maxLength || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException(name + " is invalid");
        }
    }
}
