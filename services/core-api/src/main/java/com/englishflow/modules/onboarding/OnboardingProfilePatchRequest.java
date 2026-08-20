package com.englishflow.modules.onboarding;

import java.util.List;

public record OnboardingProfilePatchRequest(
        String language,
        String targetGoal,
        String examType,
        Integer dailyQuotaMinutes,
        List<String> preferenceTags,
        String accentPreference,
        Boolean customHomeLayout,
        List<String> customHomeLayoutOrder,
        Long expectedVersion
) {
}
