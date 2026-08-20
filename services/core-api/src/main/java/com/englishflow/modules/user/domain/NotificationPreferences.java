package com.englishflow.modules.user.domain;

import java.time.Instant;
import java.util.Map;

public record NotificationPreferences(
        String tenantId,
        long userId,
        Map<String, Boolean> categorySettings,
        boolean pushEnabled,
        boolean emailEnabled,
        boolean nonEssentialSmsEnabled,
        String dndStart,
        String dndEnd,
        String timezone,
        int dailyPushLimit,
        long version,
        Instant updatedAt
) {
}
