package com.englishflow.modules.user.dto;

import java.time.Instant;

public record UserProfileResponse(
        String nickname,
        String avatarAssetCode,
        String accentPref,
        int dailyQuotaMinutes,
        boolean soundEnabled,
        boolean autoPlayAudio,
        String playbackRate,
        String performanceTier,
        long profileVersion,
        Instant updatedAt
) {
}
