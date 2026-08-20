package com.englishflow.modules.user.dto;

public record UpdatePrivacySettingsRequest(
        String leaderboardVisibility,
        String feedVisibility,
        Boolean showMinutes,
        Boolean showStreak,
        Boolean showCourse,
        Boolean showAssessment
) {
}
