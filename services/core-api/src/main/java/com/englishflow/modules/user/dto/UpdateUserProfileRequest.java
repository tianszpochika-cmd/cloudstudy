package com.englishflow.modules.user.dto;

public record UpdateUserProfileRequest(
        String nickname,
        String avatarAssetCode,
        String accentPref,
        Integer dailyQuotaMinutes
) {
}
