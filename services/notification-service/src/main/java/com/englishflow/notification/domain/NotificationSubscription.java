package com.englishflow.notification.domain;

import java.time.Instant;
import java.util.Objects;

/** M6-001 managed subscription row: per-owner, per-type, per-channel, version-guarded. */
public final class NotificationSubscription {

    private final String tenantId;
    private final String principalId;
    private final String notificationType;
    private final NotificationChannel channel;
    private final boolean subscribed;
    private final long version;
    private final Instant updatedAt;

    public NotificationSubscription(String tenantId, String principalId, String notificationType,
            NotificationChannel channel, boolean subscribed, long version, Instant updatedAt) {
        this.tenantId = token(tenantId, "tenantId");
        this.principalId = token(principalId, "principalId");
        this.notificationType = token(notificationType, "notificationType");
        this.channel = Objects.requireNonNull(channel, "channel is required");
        this.subscribed = subscribed;
        if (version < 1 || updatedAt == null) {
            throw NotificationDomainException.invalid("subscription version and updatedAt are required");
        }
        this.version = version;
        this.updatedAt = updatedAt;
    }

    public NotificationSubscription withSubscribed(boolean next, Instant changedAt) {
        return new NotificationSubscription(tenantId, principalId, notificationType, channel,
                next, version + 1, Objects.requireNonNull(changedAt, "changedAt is required"));
    }

    public String tenantId() { return tenantId; }
    public String principalId() { return principalId; }
    public String notificationType() { return notificationType; }
    public NotificationChannel channel() { return channel; }
    public boolean subscribed() { return subscribed; }
    public long version() { return version; }
    public Instant updatedAt() { return updatedAt; }

    private static String token(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 128) {
            throw NotificationDomainException.invalid(field + " is invalid");
        }
        return value.trim();
    }
}
