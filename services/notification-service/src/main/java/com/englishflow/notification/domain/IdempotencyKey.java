package com.englishflow.notification.domain;

/** Stable replay key for write commands. */
public record IdempotencyKey(String value) {

    public IdempotencyKey {
        if (value == null || value.isBlank() || value.length() > 200) {
            throw NotificationDomainException.invalid("idempotency key is invalid");
        }
        value = value.trim();
    }
}
