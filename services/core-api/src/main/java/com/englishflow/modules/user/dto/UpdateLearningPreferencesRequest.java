package com.englishflow.modules.user.dto;

public record UpdateLearningPreferencesRequest(
        String accentPref,
        Integer dailyQuotaMinutes,
        Boolean soundEnabled,
        Boolean autoPlayAudio,
        String playbackRate,
        String performanceTier
) {
}
