package com.englishflow.modules.user.dto;

import java.util.Map;

public record UpdateNotificationPreferencesRequest(
        Map<String, Boolean> categorySettings,
        Boolean pushEnabled,
        Boolean emailEnabled,
        Boolean nonEssentialSmsEnabled,
        String dndStart,
        String dndEnd,
        String timezone,
        Integer dailyPushLimit
) {
}
