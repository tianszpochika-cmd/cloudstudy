package com.englishflow.gamification.domain;

import java.time.Instant;
import java.time.LocalDate;

public record EventConsumptionReceipt(
        String settlementId,
        String eventId,
        String subjectId,
        boolean accepted,
        boolean applied,
        boolean replayed,
        String reasonCode,
        long xpDelta,
        long coinDelta,
        long xpBalance,
        long coinBalance,
        int level,
        String rewardGrantId,
        LocalDate activeDate,
        int currentStreak,
        String seasonId,
        long seasonPoints,
        Instant processedAt) {

    public EventConsumptionReceipt replay() {
        return new EventConsumptionReceipt(settlementId, eventId, subjectId, accepted, applied, true,
                reasonCode, xpDelta, coinDelta, xpBalance, coinBalance, level, rewardGrantId,
                activeDate, currentStreak, seasonId, seasonPoints, processedAt);
    }
}
