package com.englishflow.gamification.domain;

/** Stored response fingerprint for a write operation. */
public record IdempotencyRecord(
        String scope,
        String subject,
        String key,
        String fingerprint,
        Object response) {
}
