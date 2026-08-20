package com.englishflow.modules.user.domain;

import java.time.Instant;

public record LoginAlert(
        String alertId,
        String tenantId,
        long userId,
        String devicePublicId,
        String deviceType,
        String regionCode,
        String previousRegionCode,
        String reasonCode,
        Instant occurredAt
) {
}
