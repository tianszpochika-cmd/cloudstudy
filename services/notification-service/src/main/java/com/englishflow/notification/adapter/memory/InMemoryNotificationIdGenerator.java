package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.port.NotificationIdGenerator;

import java.util.UUID;

public final class InMemoryNotificationIdGenerator implements NotificationIdGenerator {

    @Override
    public String next(String prefix) {
        return prefix + '-' + UUID.randomUUID();
    }
}
