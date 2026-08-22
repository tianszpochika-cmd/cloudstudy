package com.englishflow.gamification.domain;

/** Receipt fact used for event replay and payload-conflict detection. */
public record ProcessedEvent(
        String dedupeKey,
        String fingerprint,
        CompletionSettlement settlement) {
}
