package com.englishflow.gamification.domain;

import java.time.Instant;

/** Mutable only inside the owning UserFacts transaction. */
public final class RewardGrant {

    private final String grantId;
    private final String sourceEventId;
    private final String subjectId;
    private final String rewardCode;
    private final String probabilityVersion;
    private final Instant grantedAt;
    private boolean claimed;
    private RewardOutcome outcome;
    private Instant claimedAt;

    public RewardGrant(String grantId, String sourceEventId, String subjectId, String rewardCode,
            String probabilityVersion, Instant grantedAt) {
        this.grantId = grantId;
        this.sourceEventId = sourceEventId;
        this.subjectId = subjectId;
        this.rewardCode = rewardCode;
        this.probabilityVersion = probabilityVersion;
        this.grantedAt = grantedAt;
    }

    /** Compatibility factory for the application-only reward policy helper. */
    public static RewardGrant granted(String grantId, String subjectId, String sourceEventId,
            String rewardCode, RewardProbabilityDisclosure disclosure, Instant grantedAt) {
        return new RewardGrant(grantId, sourceEventId, subjectId, rewardCode,
                disclosure.probabilityVersion(), grantedAt);
    }

    public RewardClaimReceipt claim(RewardProbabilityCatalog catalog, Instant now) {
        if (claimed) {
            return new RewardClaimReceipt(grantId, subjectId, true, true, outcome.outcomeCode(),
                    probabilityVersion, claimedAt);
        }
        outcome = catalog.resolve(grantId);
        claimed = true;
        claimedAt = now;
        return new RewardClaimReceipt(grantId, subjectId, true, false, outcome.outcomeCode(),
                probabilityVersion, claimedAt);
    }

    public RewardGrantView view() {
        return new RewardGrantView(grantId, sourceEventId, subjectId, rewardCode,
                claimed ? "CLAIMED" : "GRANTED", probabilityVersion,
                outcome == null ? null : outcome.outcomeCode(), false, 0L, grantedAt, claimedAt);
    }

    public String grantId() {
        return grantId;
    }

    public String rewardCode() {
        return rewardCode;
    }
}
