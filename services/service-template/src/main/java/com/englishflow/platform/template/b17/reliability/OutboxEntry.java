package com.englishflow.platform.template.b17.reliability;

import java.time.Instant;
import java.util.Objects;

/** Immutable outbox state; a durable adapter must persist the same lease/CAS semantics. */
public record OutboxEntry(
        ReliableEvent event,
        State state,
        int attemptCount,
        Instant availableAt,
        Instant leaseUntil,
        int replayCount) {
    public enum State { PENDING, LEASED, PUBLISHED, DLQ, MANUAL_RECOVERY }

    public OutboxEntry {
        Objects.requireNonNull(event, "event");
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(availableAt, "availableAt");
        if (attemptCount < 0 || replayCount < 0) throw new IllegalArgumentException("attempt counters cannot be negative");
    }

    public OutboxEntry lease(Instant until) {
        if (state != State.PENDING) throw new IllegalStateException("only pending outbox entries can be leased");
        return new OutboxEntry(event, State.LEASED, attemptCount + 1, availableAt, Objects.requireNonNull(until), replayCount);
    }

    public OutboxEntry published(Instant at) {
        return new OutboxEntry(event, State.PUBLISHED, attemptCount, Objects.requireNonNull(at), null, replayCount);
    }

    public OutboxEntry retry(Instant nextAttempt) {
        return new OutboxEntry(event, State.PENDING, attemptCount, Objects.requireNonNull(nextAttempt), null, replayCount);
    }

    public OutboxEntry dlq(Instant at) {
        return new OutboxEntry(event, State.DLQ, attemptCount, Objects.requireNonNull(at), null, replayCount);
    }

    public OutboxEntry replay(Instant at) {
        if (state != State.DLQ && state != State.MANUAL_RECOVERY) {
            throw new IllegalStateException("only DLQ/manual recovery entries can be replayed");
        }
        return new OutboxEntry(event, State.PENDING, attemptCount, Objects.requireNonNull(at), null, replayCount + 1);
    }
}
