package com.englishflow.modules.user.dto;

import java.time.Instant;

public record DeviceResponse(
        String devicePublicId,
        String deviceType,
        String deviceName,
        String clientVersion,
        Instant lastActiveAt,
        String regionCode,
        boolean current,
        String status
) {
}
