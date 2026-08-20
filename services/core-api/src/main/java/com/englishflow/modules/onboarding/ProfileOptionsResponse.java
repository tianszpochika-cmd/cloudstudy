package com.englishflow.modules.onboarding;

import java.util.List;

public record ProfileOptionsResponse(
        List<LearningLanguage> languages,
        List<TargetGoal> targetGoals,
        List<ExamType> examTypes,
        List<Integer> dailyQuotaMinutes,
        List<AccentPreference> accentPreferences,
        int maxPreferenceTags
) {
    public static ProfileOptionsResponse phaseOne() {
        return new ProfileOptionsResponse(
                List.of(LearningLanguage.values()),
                List.of(TargetGoal.values()),
                List.of(ExamType.values()),
                List.of(5, 15, 30, 45),
                List.of(AccentPreference.values()),
                3
        );
    }
}
