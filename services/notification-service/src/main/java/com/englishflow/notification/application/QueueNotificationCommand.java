package com.englishflow.notification.application;

import com.englishflow.notification.domain.NotificationChannel;

public record QueueNotificationCommand(
        String notificationType,
        NotificationChannel channel,
        String templateKey,
        String templateVersion,
        String title,
        String safeBody,
        String contentVersion) {

    public QueueNotificationCommand {
        require(notificationType, "notificationType");
        if (channel == null) {
            throw new IllegalArgumentException("channel is required");
        }
        require(templateKey, "templateKey");
        require(templateVersion, "templateVersion");
        require(title, "title");
        require(safeBody, "safeBody");
        require(contentVersion, "contentVersion");
    }

    public String fingerprint() {
        return String.join("|", notificationType, channel.name(), templateKey, templateVersion,
                title, safeBody, contentVersion);
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
    }
}
