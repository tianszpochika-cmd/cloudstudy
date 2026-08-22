package com.englishflow.gamification.domain;

import java.time.Instant;

public record LedgerEntry(
        String entryId,
        String currency,
        long delta,
        long balanceAfter,
        String sourceEventId,
        String reasonCode,
        String traceId,
        String ruleVersion,
        Instant occurredAt,
        Instant postedAt) {
}
