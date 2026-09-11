package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * One password-reset delivery handoff. The raw token exists only inside this boundary: it is
 * never logged, never stored in audit facts and never returned by any HTTP response.
 */
public record PasswordResetDelivery(
        String challengeId,
        PrincipalId principalId,
        String identifier,
        String rawToken,
        Instant expiresAt) {

    public PasswordResetDelivery {
        Objects.requireNonNull(challengeId, "challengeId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(identifier, "identifier");
        Objects.requireNonNull(rawToken, "rawToken");
        Objects.requireNonNull(expiresAt, "expiresAt");
    }
}
