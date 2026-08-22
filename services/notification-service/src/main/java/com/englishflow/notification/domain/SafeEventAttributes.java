package com.englishflow.notification.domain;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/** Prevents raw media, tokens and arbitrary sensitive payloads from events/logs. */
public final class SafeEventAttributes {

    private static final String[] FORBIDDEN = {
        "payload", "rawaudio", "audio", "recording", "answer", "token", "secret",
        "password", "credential", "contentbody", "body", "title", "freetext", "rawtext", "sensitive"
    };

    private SafeEventAttributes() {
    }

    public static Map<String, String> copy(Map<String, String> attributes) {
        if (attributes == null || attributes.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, String> result = new LinkedHashMap<>();
        attributes.forEach((key, value) -> {
            if (key == null || key.isBlank() || key.length() > 64 || value == null || value.length() > 200
                    || value.contains("\n") || value.contains("\r")) {
                throw NotificationDomainException.invalid("event attribute is invalid");
            }
            String normalized = key.replace("_", "").replace("-", "").toLowerCase(Locale.ROOT);
            for (String forbidden : FORBIDDEN) {
                if (normalized.contains(forbidden)) {
                    throw new NotificationDomainException(
                            NotificationDomainException.Code.PAYLOAD_NOT_ALLOWED,
                            "event attribute is not allowed");
                }
            }
            result.put(key, value);
        });
        return Map.copyOf(result);
    }
}
