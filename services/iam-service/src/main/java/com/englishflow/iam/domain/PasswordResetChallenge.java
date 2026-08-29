package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

public record PasswordResetChallenge(
        String challengeId,
        PrincipalId principalId,
        String tokenDigest,
        Instant createdAt,
        Instant expiresAt,
        boolean consumed) {
    public PasswordResetChallenge {
        Objects.requireNonNull(challengeId, "challengeId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(tokenDigest, "tokenDigest");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(expiresAt, "expiresAt");
    }

    public PasswordResetChallenge consume() {
        return new PasswordResetChallenge(challengeId, principalId, tokenDigest, createdAt, expiresAt, true);
    }
}
