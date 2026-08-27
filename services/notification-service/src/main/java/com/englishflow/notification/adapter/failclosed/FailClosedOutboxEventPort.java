package com.englishflow.notification.adapter.failclosed;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationOutboxEvent;
import com.englishflow.notification.port.OutboxEventPort;

import java.util.List;

/** Events cannot be acknowledged when the owner outbox is unavailable. */
public final class FailClosedOutboxEventPort implements OutboxEventPort {

    @Override
    public void append(NotificationOutboxEvent event) {
        throw unavailable();
    }

    @Override
    public List<NotificationOutboxEvent> events() {
        throw unavailable();
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification outbox persistence is not configured");
    }
}
