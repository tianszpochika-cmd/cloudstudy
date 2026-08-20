package com.englishflow.modules.onboarding;

import java.time.Instant;
import java.util.List;

public record OnboardingProfile(
        long userId,
        LearningLanguage language,
        TargetGoal targetGoal,
        ExamType examType,
        int dailyQuotaMinutes,
        List<String> preferenceTags,
        AccentPreference accentPreference,
        String initialCefrLevel,
        String currentCefrLevel,
        int estimatedVocabulary,
        boolean placementSkipped,
        boolean customHomeLayout,
        List<String> customHomeLayoutOrder,
        long profileVersion,
        Instant createdAt,
        Instant updatedAt
) {
    public OnboardingProfile {
        if (userId <= 0) throw new IllegalArgumentException("userId must be positive");
        if (language == null || targetGoal == null || examType == null || accentPreference == null) {
            throw new IllegalArgumentException("profile enums are required");
        }
        DailyDuration.fromMinutes(dailyQuotaMinutes);
        validateCefr(initialCefrLevel);
        validateCefr(currentCefrLevel);
        if (estimatedVocabulary < 0) throw new IllegalArgumentException("estimatedVocabulary must be non-negative");
        preferenceTags = preferenceTags == null ? List.of() : List.copyOf(preferenceTags);
        customHomeLayoutOrder = customHomeLayoutOrder == null ? List.of() : List.copyOf(customHomeLayoutOrder);
    }

    public int dailyQuotaXp() {
        return DailyDuration.fromMinutes(dailyQuotaMinutes).xp();
    }

    public DailyDuration dailyDuration() {
        return DailyDuration.fromMinutes(dailyQuotaMinutes);
    }

    private static void validateCefr(String level) {
        if (level == null || !level.matches("A1|A2|B1|B2|C1|C2")) {
            throw new IllegalArgumentException("CEFR level must be A1, A2, B1, B2, C1, or C2");
        }
    }
}
