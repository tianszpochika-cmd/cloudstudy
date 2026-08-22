package com.englishflow.notification.domain;

import java.time.Instant;
import java.util.Set;

/** Service-owned preference, with a channel view for direct smoke fixtures. */
public final class NotificationPreference {

    private final String tenantId;
    private final String principalId;
    private final String notificationType;
    private final NotificationChannel channel;
    private final boolean enabled;
    private final String locale;
    private final long version;
    private final Instant updatedAt;
    private final boolean learningReminders;
    private final boolean marketing;

    public NotificationPreference(String tenantId, String principalId, String notificationType,
            NotificationChannel channel, boolean enabled, String locale, long version, Instant updatedAt) {
        this(tenantId, principalId, notificationType, channel, enabled, locale, version, updatedAt,
                enabled, false);
    }

    /** Compatibility constructor for template-only smoke fixtures. */
    public NotificationPreference(String tenantId, String principalId, Set<NotificationChannel> enabledChannels,
            boolean learningReminders, boolean marketing, long version) {
        this(tenantId, principalId, "general", NotificationChannel.IN_APP,
                enabledChannels != null && enabledChannels.contains(NotificationChannel.IN_APP),
                "zh-CN", version, Instant.EPOCH, learningReminders, marketing);
    }

    private NotificationPreference(String tenantId, String principalId, String notificationType,
            NotificationChannel channel, boolean enabled, String locale, long version, Instant updatedAt,
            boolean learningReminders, boolean marketing) {
        this.tenantId = require(tenantId, "tenantId");
        this.principalId = require(principalId, "principalId");
        this.notificationType = require(notificationType, "notificationType");
        this.channel = channel == null ? invalidChannel() : channel;
        this.enabled = enabled;
        this.locale = require(locale, "locale");
        if (version < 1 || updatedAt == null) {
            throw NotificationDomainException.invalid("preference version and updatedAt are required");
        }
        this.version = version;
        this.updatedAt = updatedAt;
        this.learningReminders = learningReminders;
        this.marketing = marketing;
    }

    public static NotificationPreference defaults(String tenantId, String principalId) {
        return new NotificationPreference(tenantId, principalId, "general", NotificationChannel.IN_APP,
                true, "zh-CN", 1, Instant.EPOCH);
    }

    public String tenantId() { return tenantId; }
    public String principalId() { return principalId; }
    public String notificationType() { return notificationType; }
    public NotificationChannel channel() { return channel; }
    public boolean enabled() { return enabled; }
    public String locale() { return locale; }
    public long version() { return version; }
    public Instant updatedAt() { return updatedAt; }
    public boolean learningReminders() { return learningReminders; }
    public boolean marketing() { return marketing; }

    // JavaBean accessors keep HTTP JSON serialization explicit for this non-record aggregate.
    public String getTenantId() { return tenantId; }
    public String getPrincipalId() { return principalId; }
    public String getNotificationType() { return notificationType; }
    public NotificationChannel getChannel() { return channel; }
    public boolean isEnabled() { return enabled; }
    public String getLocale() { return locale; }
    public long getVersion() { return version; }
    public Instant getUpdatedAt() { return updatedAt; }

    public Set<NotificationChannel> enabledChannels() {
        return enabled ? Set.of(channel) : Set.of();
    }

    public NotificationPreference change(boolean nextEnabled, String nextLocale, Instant changedAt) {
        return new NotificationPreference(tenantId, principalId, notificationType, channel,
                nextEnabled, nextLocale, version + 1, changedAt, learningReminders, marketing);
    }

    private static String require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw NotificationDomainException.invalid(field + " is required");
        }
        return value.trim();
    }

    private static NotificationChannel invalidChannel() {
        throw NotificationDomainException.invalid("channel is required");
    }
}
