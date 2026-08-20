package com.englishflow.modules.auth;

import java.time.OffsetDateTime;

public record AuthTokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        OffsetDateTime accessTokenExpiresAt,
        OffsetDateTime refreshTokenExpiresAt,
        long expiresIn,
        long refreshExpiresIn,
        long userId,
        String deviceId,
        String sessionId
) {
}
