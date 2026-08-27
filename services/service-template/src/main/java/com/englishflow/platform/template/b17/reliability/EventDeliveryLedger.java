package com.englishflow.platform.template.b17.reliability;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Consumer-side dedupe and per-aggregate ordering guard. */
public final class EventDeliveryLedger {
    public enum Result { APPLIED, DUPLICATE, BUFFERED, REJECTED }

    @FunctionalInterface
    public interface Handler { void apply(ReliableEvent event); }

    private final Set<String> eventIds = new HashSet<>();
    private final Map<String, String> idempotencyToEvent = new HashMap<>();
    private final Map<String, Long> lastSequence = new HashMap<>();

    public synchronized Result deliver(ReliableEvent event, Handler handler) {
        Objects.requireNonNull(event, "event");
        Objects.requireNonNull(handler, "handler");
        if (eventIds.contains(event.eventId()) || idempotencyToEvent.containsKey(event.idempotencyKey())) return Result.DUPLICATE;
        long expected = lastSequence.getOrDefault(event.aggregateId(), 0L) + 1;
        if (event.aggregateSequence() > expected) return Result.BUFFERED;
        if (event.aggregateSequence() < expected) return Result.REJECTED;
        handler.apply(event);
        eventIds.add(event.eventId());
        idempotencyToEvent.put(event.idempotencyKey(), event.eventId());
        lastSequence.put(event.aggregateId(), event.aggregateSequence());
        return Result.APPLIED;
    }

    public synchronized long lastSequence(String aggregateId) {
        return lastSequence.getOrDefault(aggregateId, 0L);
    }
}
