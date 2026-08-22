package com.englishflow.iam.oidc;

import java.net.URI;
import java.util.Objects;

/** OAuth callback input. The code verifier is never accepted from the browser callback. */
public record AuthorizationCallback(
        String providerId,
        String state,
        String authorizationCode,
        URI redirectUri) {

    public AuthorizationCallback {
        require(providerId, "providerId");
        require(state, "state");
        require(authorizationCode, "authorizationCode");
        Objects.requireNonNull(redirectUri, "redirectUri");
    }

    private static void require(String value, String name) {
        Objects.requireNonNull(value, name);
        if (value.isBlank() || value.length() > 4096 || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException(name + " is invalid");
        }
    }
}
