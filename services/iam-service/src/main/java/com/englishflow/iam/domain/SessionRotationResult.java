package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/**
 * Internal rotation result. The refresh credential was issued by the external provider; IAM does
 * not sign, mint or expose a platform token here.
 */
public record SessionRotationResult(
        SessionId sessionId,
        PrincipalId principalId,
        DeviceId deviceId,
        long rotation,
        String nextProviderRefreshToken,
        Instant accessTokenExpiresAt) {

    public SessionRotationResult {
        Objects.requireNonNull(sessionId, "sessionId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(nextProviderRefreshToken, "nextProviderRefreshToken");
        Objects.requireNonNull(accessTokenExpiresAt, "accessTokenExpiresAt");
    }
}
