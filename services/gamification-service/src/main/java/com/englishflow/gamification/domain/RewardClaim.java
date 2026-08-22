package com.englishflow.gamification.domain;

import java.time.Instant;

/** Append-only claim fact; it never writes XP or coin ledgers. */
public record RewardClaim(
        String claimId,
        String grantId,
        String subject,
        String rewardCode,
        String idempotencyKey,
        Instant claimedAt) {
}
