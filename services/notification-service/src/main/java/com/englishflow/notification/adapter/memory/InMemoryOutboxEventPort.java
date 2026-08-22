package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.NotificationOutboxEvent;
import com.englishflow.notification.port.OutboxEventPort;

import java.util.ArrayList;
import java.util.List;

public final class InMemoryOutboxEventPort implements OutboxEventPort {

    private final List<NotificationOutboxEvent> events = new ArrayList<>();

    @Override
    public synchronized void append(NotificationOutboxEvent event) {
        events.add(event);
    }

    @Override
    public synchronized List<NotificationOutboxEvent> events() {
        return List.copyOf(events);
    }
}
