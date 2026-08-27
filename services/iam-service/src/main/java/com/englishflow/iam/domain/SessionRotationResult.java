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
        Instant accessTokenExpiresAt,
        String nextProviderAccessToken) {

    public SessionRotationResult(
            SessionId sessionId,
            PrincipalId principalId,
            DeviceId deviceId,
            long rotation,
            String nextProviderRefreshToken,
            Instant accessTokenExpiresAt) {
        this(sessionId, principalId, deviceId, rotation, nextProviderRefreshToken, accessTokenExpiresAt, null);
    }

    public SessionRotationResult {
        Objects.requireNonNull(sessionId, "sessionId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(nextProviderRefreshToken, "nextProviderRefreshToken");
        Objects.requireNonNull(accessTokenExpiresAt, "accessTokenExpiresAt");
        if (nextProviderAccessToken != null && nextProviderAccessToken.isBlank()) {
            throw new IllegalArgumentException("next provider access token must not be blank");
        }
    }
}
