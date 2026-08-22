package com.englishflow.gamification.domain;

import java.time.Instant;

/** Server settlement response; replay never changes the original accounting result. */
public record CompletionSettlement(
        boolean accepted,
        boolean replayed,
        boolean featureEnabled,
        boolean sideEffectApplied,
        String subject,
        String sourceEventKey,
        long xp,
        long coins,
        long seasonPoints,
        String rewardGrantId,
        long xpBalanceAfter,
        long coinBalanceAfter,
        int level,
        StreakProjection streak,
        String reasonCode,
        Instant processedAt) {

    public CompletionSettlement asReplay() {
        return new CompletionSettlement(accepted, true, featureEnabled, sideEffectApplied, subject,
                sourceEventKey, xp, coins, seasonPoints, rewardGrantId, xpBalanceAfter, coinBalanceAfter,
                level, streak, reasonCode, processedAt);
    }
}
