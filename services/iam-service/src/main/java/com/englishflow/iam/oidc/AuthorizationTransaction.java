package com.englishflow.iam.oidc;

import java.net.URI;
import java.time.Instant;
import java.util.Objects;

/** Server-side one-time transaction retaining state, nonce and PKCE verifier. */
public record AuthorizationTransaction(
        String providerId,
        String clientId,
        URI redirectUri,
        String state,
        String nonce,
        String codeVerifier,
        String codeChallenge,
        Instant createdAt) {

    public AuthorizationTransaction {
        Objects.requireNonNull(providerId, "providerId");
        Objects.requireNonNull(clientId, "clientId");
        Objects.requireNonNull(redirectUri, "redirectUri");
        require(state, "state");
        require(nonce, "nonce");
        require(codeVerifier, "codeVerifier");
        require(codeChallenge, "codeChallenge");
        Objects.requireNonNull(createdAt, "createdAt");
    }

    private static void require(String value, String name) {
        Objects.requireNonNull(value, name);
        if (value.isBlank() || value.length() > 256 || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException(name + " is invalid");
        }
    }
}
