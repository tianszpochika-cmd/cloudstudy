package com.englishflow.modules.user.domain;

import java.time.Instant;

public record PrivacySettings(
        String tenantId,
        long userId,
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
