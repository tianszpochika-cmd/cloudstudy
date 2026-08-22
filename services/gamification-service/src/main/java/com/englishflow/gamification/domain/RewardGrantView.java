package com.englishflow.gamification.domain;

import java.time.Instant;

public record RewardGrantView(
        String grantId,
        String sourceEventId,
        String subjectId,
        String rewardCode,
        String status,
        String probabilityVersion,
        String outcomeCode,
        boolean cashReward,
        long cashValueMinor,
        Instant grantedAt,
        Instant claimedAt) {
}
