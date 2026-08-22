package com.englishflow.gamification.domain;

public record GamificationSummary(
        String subjectId,
        long xp,
        long coins,
        LevelProjection level,
        StreakProjection streak,
        SeasonProjection season,
        boolean ledgerConserved) {
}
