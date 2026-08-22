package com.englishflow.gamification.domain;

/** Server-owned reward table entry. No field is populated from an incoming event payload. */
public record RewardRule(
        String reasonCode,
        long xp,
        long coins,
        long seasonPoints,
        boolean rewardEligible) {

    public RewardRule {
        if (reasonCode == null || reasonCode.isBlank()) {
            throw new IllegalArgumentException("reasonCode is required");
        }
        if (xp < 0 || coins < 0 || seasonPoints < 0) {
            throw new IllegalArgumentException("rule values cannot be negative");
        }
    }
}
