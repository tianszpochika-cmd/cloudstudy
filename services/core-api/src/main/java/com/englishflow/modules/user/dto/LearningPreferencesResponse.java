package com.englishflow.modules.user.dto;

import java.time.Instant;

public record LearningPreferencesResponse(
        String accentPref,
        int dailyQuotaMinutes,
        boolean soundEnabled,
        boolean autoPlayAudio,
        String playbackRate,
        String performanceTier,
        long version,
        Instant updatedAt
) {
}
