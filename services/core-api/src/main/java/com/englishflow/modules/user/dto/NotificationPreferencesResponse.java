package com.englishflow.modules.user.dto;

import java.time.Instant;
import java.util.Map;

public record NotificationPreferencesResponse(
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
