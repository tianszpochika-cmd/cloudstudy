package com.englishflow.iam.oidc;

import java.net.URI;
import java.util.Objects;

/** Data passed from the client flow to an external provider adapter. */
public record AuthorizationCodeExchange(
        String providerId,
        String clientId,
        String authorizationCode,
        URI redirectUri,
        String codeVerifier,
        String expectedNonce) {

    public AuthorizationCodeExchange(
            String providerId,
            String authorizationCode,
            URI redirectUri,
            String codeVerifier) {
        this(providerId, null, authorizationCode, redirectUri, codeVerifier, null);
    }

    public AuthorizationCodeExchange(
            String providerId,
            String authorizationCode,
            URI redirectUri,
            String codeVerifier,
            String expectedNonce) {
        this(providerId, null, authorizationCode, redirectUri, codeVerifier, expectedNonce);
    }

    public AuthorizationCodeExchange {
        require(providerId, "providerId", 64);
        if (clientId != null) {
            require(clientId, "clientId", 128);
        }
        require(authorizationCode, "authorizationCode", 4096);
        Objects.requireNonNull(redirectUri, "redirectUri");
        require(codeVerifier, "codeVerifier", 128);
        if (expectedNonce != null) {
            require(expectedNonce, "expectedNonce", 256);
        }
    }

    private static void require(String value, String name, int maxLength) {
        Objects.requireNonNull(value, name);
        if (value.isBlank() || value.length() > maxLength || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException(name + " is invalid");
        }
    }
}
