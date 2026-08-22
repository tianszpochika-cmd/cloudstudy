package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.NotificationAuditEvent;
import com.englishflow.notification.port.NotificationAuditEventPort;

import java.util.ArrayList;
import java.util.List;

/** Append-only local audit adapter. Returned records and attributes are immutable. */
public final class InMemoryNotificationAuditEventStore implements NotificationAuditEventPort {

    private final List<NotificationAuditEvent> events = new ArrayList<>();

    @Override
    public synchronized void append(NotificationAuditEvent event) {
        events.add(event);
    }

    @Override
    public synchronized List<NotificationAuditEvent> events() {
        return List.copyOf(events);
    }
}
