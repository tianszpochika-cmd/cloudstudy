package com.englishflow.platform.template.b17.reliability;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/** Bounded local/test adapter; production replaces it with service-owned MySQL Outbox + Kafka. */
public final class InMemoryOutboxStore {
    private final int maxEntries;
    private final int maxAttempts;
    private final Map<String, OutboxEntry> entries = new LinkedHashMap<>();
    private final Map<String, String> dedupeToEvent = new LinkedHashMap<>();

    public InMemoryOutboxStore(int maxEntries, int maxAttempts) {
        if (maxEntries < 1 || maxAttempts < 1) throw new IllegalArgumentException("outbox bounds must be positive");
        this.maxEntries = maxEntries;
        this.maxAttempts = maxAttempts;
    }

    public synchronized OutboxEntry append(ReliableEvent event, Instant now) {
        Objects.requireNonNull(event, "event");
        Objects.requireNonNull(now, "now");
        String existingId = dedupeToEvent.get(event.idempotencyKey());
        if (existingId != null) return entries.get(existingId);
        if (entries.size() >= maxEntries) throw new IllegalStateException("outbox capacity reached");
        OutboxEntry entry = new OutboxEntry(event, OutboxEntry.State.PENDING, 0, now, null, 0);
        entries.put(event.eventId(), entry);
        dedupeToEvent.put(event.idempotencyKey(), event.eventId());
        return entry;
    }

    public synchronized List<OutboxEntry> leaseReady(Instant now, Duration lease, int limit) {
        Objects.requireNonNull(now, "now");
        Objects.requireNonNull(lease, "lease");
        if (lease.isNegative() || lease.isZero() || limit < 1) throw new IllegalArgumentException("invalid lease request");
        List<OutboxEntry> result = new ArrayList<>();
        entries.values().stream()
                .filter(entry -> entry.state() == OutboxEntry.State.PENDING && !entry.availableAt().isAfter(now))
                .sorted(Comparator.comparing(entry -> entry.event().aggregateId()))
                .limit(limit)
                .forEach(entry -> {
                    OutboxEntry leased = entry.lease(now.plus(lease));
                    entries.put(entry.event().eventId(), leased);
                    result.add(leased);
                });
        return List.copyOf(result);
    }

    public synchronized void markPublished(String eventId, Instant now) {
        replace(eventId, entry -> entry.state() == OutboxEntry.State.LEASED ? entry.published(now) : entry);
    }

    public synchronized OutboxEntry retryOrDlq(String eventId, Instant now, Duration backoff) {
        Objects.requireNonNull(backoff, "backoff");
        if (backoff.isNegative()) throw new IllegalArgumentException("backoff cannot be negative");
        OutboxEntry current = findRequired(eventId);
        if (current.state() != OutboxEntry.State.LEASED) throw new IllegalStateException("only leased events can retry");
        OutboxEntry next = current.attemptCount() >= maxAttempts
                ? current.dlq(now)
                : current.retry(now.plus(backoff));
        entries.put(eventId, next);
        return next;
    }

    public synchronized OutboxEntry replay(String eventId, Instant now) {
        OutboxEntry current = findRequired(eventId);
        OutboxEntry replayed = current.replay(now);
        entries.put(eventId, replayed);
        return replayed;
    }

    public synchronized Optional<OutboxEntry> find(String eventId) {
        return Optional.ofNullable(entries.get(eventId));
    }

    public synchronized long size() { return entries.size(); }

    private OutboxEntry findRequired(String eventId) {
        OutboxEntry entry = entries.get(eventId);
        if (entry == null) throw new IllegalArgumentException("unknown outbox event");
        return entry;
    }

    private void replace(String eventId, java.util.function.UnaryOperator<OutboxEntry> updater) {
        OutboxEntry current = findRequired(eventId);
        entries.put(eventId, updater.apply(current));
    }
}
