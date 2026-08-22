package com.englishflow.gamification.domain;

import java.time.Instant;

public record RewardClaimReceipt(
        String grantId,
        String subjectId,
        boolean claimed,
        boolean replayed,
        String outcomeCode,
        String probabilityVersion,
        Instant claimedAt) {

    public RewardClaimReceipt replay() {
        return new RewardClaimReceipt(grantId, subjectId, claimed, true, outcomeCode,
                probabilityVersion, claimedAt);
    }
}
