package com.englishflow.notification.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical service-owned M1-016 preference fact. consentVersion is a
 * client-declared version label stored as preference metadata only. It is never
 * a consent decision, authorization input, or evidence that consent was granted;
 * delivery authorization must use the separate server-owned consent fact.
 */
public final class NotificationPreference {

    private final String tenantId;
    private final String principalId;
    private final NotificationCategory category;
    private final NotificationChannel channel;
    private final boolean enabled;
    private final String locale;
    private final int consentVersion;
    private final NotificationDndWindow dndWindow;
    private final NotificationFrequencyPolicy frequencyPolicy;
    private final long version;
    private final Instant updatedAt;

    public NotificationPreference(String tenantId, String principalId, NotificationCategory category,
            NotificationChannel channel, boolean enabled, String locale, int consentVersion,
            NotificationDndWindow dndWindow, NotificationFrequencyPolicy frequencyPolicy,
            long version, Instant updatedAt) {
        this.tenantId = require(tenantId, "tenantId");
        this.principalId = require(principalId, "principalId");
        this.category = Objects.requireNonNull(category, "category");
        this.channel = Objects.requireNonNull(channel, "channel");
        this.enabled = enabled;
        if (!"zh-CN".equals(locale)) {
            throw NotificationDomainException.invalid("preference locale is not allowed");
        }
        this.locale = locale;
        if (consentVersion < 1) {
            throw NotificationDomainException.invalid("consentVersion must be positive");
        }
        this.consentVersion = consentVersion;
        this.dndWindow = Objects.requireNonNull(dndWindow, "dndWindow");
        this.frequencyPolicy = Objects.requireNonNull(frequencyPolicy, "frequencyPolicy");
        if (version < 1 || updatedAt == null) {
            throw NotificationDomainException.invalid("preference version and updatedAt are required");
        }
        this.version = version;
        this.updatedAt = updatedAt;
    }

    public String tenantId() { return tenantId; }
    public String principalId() { return principalId; }
    public NotificationCategory category() { return category; }
    public NotificationChannel channel() { return channel; }
    public boolean enabled() { return enabled; }
    public String locale() { return locale; }
    public int consentVersion() { return consentVersion; }
    public NotificationDndWindow dndWindow() { return dndWindow; }
    public NotificationFrequencyPolicy frequencyPolicy() { return frequencyPolicy; }
    public long version() { return version; }
    public Instant updatedAt() { return updatedAt; }

    // Explicit JavaBean properties keep stored idempotency snapshots canonical.
    public String getTenantId() { return tenantId; }
    public String getPrincipalId() { return principalId; }
    public NotificationCategory getCategory() { return category; }
    public NotificationChannel getChannel() { return channel; }
    public boolean isEnabled() { return enabled; }
    public String getLocale() { return locale; }
    public int getConsentVersion() { return consentVersion; }
    public NotificationDndWindow getDndWindow() { return dndWindow; }
    public NotificationFrequencyPolicy getFrequencyPolicy() { return frequencyPolicy; }
    public long getVersion() { return version; }
    public Instant getUpdatedAt() { return updatedAt; }

    /** Compatibility projection for the historical single-channel settings view. */
    public Set<NotificationChannel> enabledChannels() {
        return enabled ? Set.of(channel) : Set.of();
    }

    public NotificationPreference change(boolean nextEnabled, String nextLocale, int nextConsentVersion,
            NotificationDndWindow nextDndWindow, NotificationFrequencyPolicy nextFrequencyPolicy,
            Instant changedAt) {
        return new NotificationPreference(tenantId, principalId, category, channel, nextEnabled, nextLocale,
                nextConsentVersion, nextDndWindow, nextFrequencyPolicy, version + 1, changedAt);
    }

    private static String require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw NotificationDomainException.invalid(field + " is required");
        }
        return value.trim();
    }
}
