package com.englishflow.notification.application;

import com.englishflow.notification.domain.NotificationChannel;

public record UpdatePreferenceCommand(
        String notificationType,
        NotificationChannel channel,
        boolean enabled,
        String locale,
        long expectedVersion) {

    public UpdatePreferenceCommand {
        if (notificationType == null || notificationType.isBlank() || channel == null
                || locale == null || locale.isBlank() || expectedVersion < -1) {
            throw new IllegalArgumentException("preference command is invalid");
        }
    }

    public String fingerprint() {
        return notificationType + '|' + channel + '|' + enabled + '|' + locale + '|' + expectedVersion;
    }
}
