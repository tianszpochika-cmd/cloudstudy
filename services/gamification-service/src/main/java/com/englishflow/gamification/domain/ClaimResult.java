package com.englishflow.gamification.domain;

import java.time.Instant;

/** Claim result; a replay returns the same claim facts without a second grant. */
public record ClaimResult(
        boolean claimed,
        boolean replayed,
        String grantId,
        String claimId,
        String rewardCode,
        RewardProbabilityDisclosure disclosure,
        Instant claimedAt) {

    public ClaimResult asReplay() {
        return new ClaimResult(claimed, true, grantId, claimId, rewardCode, disclosure, claimedAt);
    }
}
