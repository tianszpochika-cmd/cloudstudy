package com.englishflow.notification.port;

public interface NotificationIdGenerator {

    String next(String prefix);
}
