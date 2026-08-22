package com.englishflow.notification.application;

import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.SafeEventAttributes;

import java.time.Instant;
import java.util.Map;

/** Internal template-only notification command; it has no title/body input. */
public record TemplateNotificationCommand(
        String notificationType,
        NotificationChannel channel,
        String templateId,
        String templateVersion,
        String locale,
        Map<String, String> structuredAttributes,
        String contentVersion,
        Instant notBefore) {

    public TemplateNotificationCommand {
        require(notificationType, "notificationType");
        if (channel == null) {
            throw new IllegalArgumentException("channel is required");
        }
        requireToken(templateId, "templateId", 96);
        requireToken(templateVersion, "templateVersion", 40);
        requireLocale(locale);
        structuredAttributes = SafeEventAttributes.copy(structuredAttributes);
        requireToken(contentVersion, "contentVersion", 80);
        if (notBefore == null) {
            throw new IllegalArgumentException("notBefore is required");
        }
    }

    public String fingerprint() {
        return notificationType + '|' + channel.name() + '|' + templateId + '|' + templateVersion + '|'
                + locale + '|' + structuredAttributes + '|' + contentVersion + '|' + notBefore;
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
    }

    private static void requireToken(String value, String field, int maxLength) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0," + (maxLength - 1) + "}")) {
            throw new IllegalArgumentException(field + " is invalid");
        }
    }

    private static void requireLocale(String value) {
        if (value == null || !value.matches("[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?")) {
            throw new IllegalArgumentException("locale is invalid");
        }
    }
}
