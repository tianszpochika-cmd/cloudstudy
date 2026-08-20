package com.englishflow.modules.user.domain;

import java.time.Instant;

public record UserProfile(
        String tenantId,
        long userId,
        String nickname,
        String avatarAssetCode,
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
