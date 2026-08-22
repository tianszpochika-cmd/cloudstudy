package com.englishflow.gamification.domain;

import java.time.Instant;

public record SeasonFact(
        String seasonId,
        String eventId,
        String subjectId,
        long points,
        String ruleVersion,
        Instant occurredAt,
        Instant recordedAt) {
}
