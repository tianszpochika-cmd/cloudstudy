package com.englishflow.modules.auth;

import java.time.OffsetDateTime;

public record DeviceSessionView(
        String sessionId,
        String deviceId,
        String deviceType,
        String deviceName,
        String clientVersion,
        String regionCode,
        OffsetDateTime lastActiveAt,
        SessionStatus status,
        boolean current
) {
}
