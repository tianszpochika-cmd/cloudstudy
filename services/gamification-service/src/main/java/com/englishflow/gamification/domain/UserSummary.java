package com.englishflow.gamification.domain;

/** Read-only owner-scoped summary. */
public record UserSummary(
        String subject,
        long xp,
        long coins,
        int level,
        long levelProgressXp,
        Long nextLevelXp,
        long levelProgressTotalXp,
        StreakProjection streak,
        SeasonSummary season,
        boolean featureEnabled,
        boolean ledgerConserved,
        RewardProbabilityDisclosure rewardProbabilityDisclosure,
        String ruleVersion) {
}
