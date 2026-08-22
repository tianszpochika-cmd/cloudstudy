package com.englishflow.notification.port;

import com.englishflow.notification.domain.NotificationOutboxEvent;

import java.util.List;

/** Event outbox seam; a Kafka/CDC adapter may replace the memory implementation. */
public interface OutboxEventPort {

    void append(NotificationOutboxEvent event);

    List<NotificationOutboxEvent> events();
}
