package com.englishflow.commerce.adapter.memory;

import com.englishflow.commerce.application.ports.OutboxPort;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class InMemoryOutboxPort implements OutboxPort {
    private final CopyOnWriteArrayList<Event> events = new CopyOnWriteArrayList<>();

    @Override
    public void append(Event event) {
        events.add(event);
    }

    public List<Event> events() {
        return List.copyOf(events);
    }
}
