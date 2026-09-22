package com.englishflow.learning.port;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Publish-side view of the learning outbox (M5-013). Claiming is deliberately
 * separate from publishing: the claim transaction commits first so no row lock
 * is ever held across a broker round trip.
 */
public interface LearningOutboxRelayPort {

    /** A row claimed for publishing, carrying exactly the envelope the contract requires on the wire. */
    record ClaimedEvent(
            String eventId,
            String aggregateId,
            String eventName,
            String schemaVersion,
            int eventVersion,
            String dedupeKey,
            String payloadJson,
            String requestId,
            String traceId,
            int attemptCount) {
    }

    /**
     * Claims up to {@code batchSize} due rows with FOR UPDATE SKIP LOCKED, moves them to PUBLISHING
     * and stamps the lease. Rows already leased by another instance are skipped, not waited on.
     */
    List<ClaimedEvent> claim(String instanceId, Instant now, int batchSize, Duration lease);

    /** Marks the row published. Called only after the broker acknowledged the record. */
    void markPublished(String eventId, Instant publishedAt);

    /**
     * Reschedules a failed attempt with the supplied backoff, or routes it to DLQ once the attempt
     * budget is exhausted.
     */
    void markFailed(String eventId, Instant availableAt, boolean exhausted, String errorCode, String errorMessage);

    /** Returns rows whose publishing lease expired, so a crashed relay cannot strand them. */
    int reclaimExpiredLeases(Instant now);
}
