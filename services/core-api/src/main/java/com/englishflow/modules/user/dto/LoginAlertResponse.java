package com.englishflow.modules.user.dto;

import java.time.Instant;

public record LoginAlertResponse(
        String alertId,
        String devicePublicId,
        String deviceType,
        String regionCode,
        String previousRegionCode,
        String reasonCode,
        Instant occurredAt
) {
}
