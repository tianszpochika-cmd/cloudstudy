package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentOutboxEvent;
import com.englishflow.content.port.ContentOutboxPort;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Deterministic outbox test double with durable-key semantics represented in memory. */
public final class InMemoryContentOutbox implements ContentOutboxPort {

    private final Map<String, ContentOutboxEvent> eventsByDedupeKey = new ConcurrentHashMap<>();

    @Override
    public void appendAfterFact(ContentOutboxEvent event) {
        ContentOutboxEvent previous = eventsByDedupeKey.putIfAbsent(event.dedupeKey(), event);
        if (previous != null && !previous.eventType().equals(event.eventType())) {
            throw ContentOperationException.conflict(
                    "OUTBOX_DEDUPE_CONFLICT", "outbox dedupe key was reused for another event");
        }
    }

    public List<ContentOutboxEvent> events() {
        return List.copyOf(eventsByDedupeKey.values());
    }

    public long countByType(String eventType) {
        return eventsByDedupeKey.values().stream()
                .filter(event -> event.eventType().equals(eventType))
                .count();
    }
}
