package com.englishflow.notification.adapter.failclosed;

import com.englishflow.notification.domain.NotificationAuditEvent;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.port.NotificationAuditEventPort;

import java.util.List;

/** Audit facts fail closed when durable storage is not configured. */
public final class FailClosedNotificationAuditEventStore implements NotificationAuditEventPort {

    @Override
    public void append(NotificationAuditEvent event) {
        throw unavailable();
    }

    @Override
    public List<NotificationAuditEvent> events() {
        throw unavailable();
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification audit persistence is not configured");
    }
}
