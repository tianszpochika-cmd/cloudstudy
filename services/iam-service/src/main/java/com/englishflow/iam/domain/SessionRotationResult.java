package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

public record SessionRotationResult(
        SessionId sessionId,
        PrincipalId principalId,
        DeviceId deviceId,
        long rotation,
        String nextRefreshToken,
        Instant accessTokenExpiresAt) {
    public SessionRotationResult {
        Objects.requireNonNull(sessionId, "sessionId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(nextRefreshToken, "nextRefreshToken");
        Objects.requireNonNull(accessTokenExpiresAt, "accessTokenExpiresAt");
    }
}
