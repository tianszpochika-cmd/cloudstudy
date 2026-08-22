package com.englishflow.gamification.domain;

/** Server-owned reward rule. No value in this record comes from an event payload. */
public record CompletionRule(
        String eventType,
        long xpDelta,
        long coinDelta,
        long seasonPoints,
        String rewardCode) {
}
