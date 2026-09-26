package com.englishflow.notification.application;

import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;

import java.util.Objects;

/**
 * Canonical client-writable preference fields plus the path purpose used for
 * exact policy checks. consentVersion is a client declaration only and is never
 * promoted to consent evidence or a delivery authorization grant.
 */
public record UpdatePreferenceCommand(
        String notificationType,
        NotificationCategory category,
        NotificationChannel channel,
        boolean enabled,
        String locale,
        int consentVersion,
        NotificationDndWindow dndWindow,
        NotificationFrequencyPolicy frequencyPolicy,
        long expectedVersion) {

    public UpdatePreferenceCommand {
        if (notificationType == null || notificationType.isBlank()) {
            throw NotificationDomainException.invalid("notificationType is required");
        }
        Objects.requireNonNull(category, "category");
        Objects.requireNonNull(channel, "channel");
        if (!NotificationCategory.fromPathType(notificationType).filter(category::equals).isPresent()) {
            throw new NotificationDomainException(NotificationDomainException.Code.FORBIDDEN,
                    "notification type and category are not an allowed pair");
        }
        if (channel == NotificationChannel.SMS && !NotificationCategory.isSmsPurposeType(notificationType)) {
            throw new NotificationDomainException(NotificationDomainException.Code.FORBIDDEN,
                    "SMS preference purpose is not allow-listed");
        }
        if (!"zh-CN".equals(locale) || consentVersion < 1 || expectedVersion < 0) {
            throw NotificationDomainException.invalid("notification preference command is invalid");
        }
        Objects.requireNonNull(dndWindow, "dndWindow");
        Objects.requireNonNull(frequencyPolicy, "frequencyPolicy");
    }

    public String fingerprint() {
        return String.join("|", notificationType, category.name(), channel.name(), Boolean.toString(enabled), locale,
                Integer.toString(consentVersion), dndWindow.startWireValue(), dndWindow.endWireValue(),
                frequencyPolicy.name(), Long.toString(expectedVersion));
    }
}
