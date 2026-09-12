package com.englishflow.content.port;

import java.time.Instant;

/**
 * Consumer-side idempotency for inbound integration events.
 *
 * <p>The event runtime contract requires the effect and the deduplication record to be written
 * atomically and forbids a duplicate effect, so the only correct implementation is a single
 * transaction in which the receipt insert either succeeds (and the effect runs) or conflicts (and
 * nothing at all happens). An implementation that checks for the receipt first and then applies the
 * effect in a second transaction is unsafe under at-least-once delivery and must not be used.
 */
public interface ContentInboundEventPort {

    /** The inbound envelope the contract requires a consumer to be able to deduplicate on. */
    record InboundEvent(
            String consumerGroup,
            String eventId,
            String eventName,
            String schemaVersion,
            String dedupeKey,
            String payloadHash) {
    }

    /** Whether this delivery applied an effect or was recognised as a duplicate. */
    enum ApplyOutcome {
        APPLIED,
        DUPLICATE
    }

    /**
     * Applies the event once. Returns {@link ApplyOutcome#DUPLICATE} without touching any effect when
     * the same (consumerGroup, eventId) was already applied.
     */
    ApplyOutcome applyOnce(InboundEvent event, Instant receivedAt);
}
