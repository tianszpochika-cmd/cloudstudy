package com.englishflow.modules.user.dto;

import java.time.Instant;

public record PrivacySettingsResponse(
        String leaderboardVisibility,
        String feedVisibility,
        boolean showMinutes,
        boolean showStreak,
        boolean showCourse,
        boolean showAssessment,
        long version,
        Instant updatedAt
) {
}
