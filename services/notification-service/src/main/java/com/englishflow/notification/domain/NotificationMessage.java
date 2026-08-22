package com.englishflow.notification.domain;

import java.time.Instant;
import java.util.Map;

/** Template reference plus safe display text; no arbitrary JSON/audio payload. */
public final class NotificationMessage {

    private final String messageId;
    private final String tenantId;
    private final String principalId;
    private final String notificationType;
    private final NotificationChannel channel;
    private final String templateKey;
    private final String templateVersion;
    private final String title;
    private final String safeBody;
    private final String contentVersion;
    private final String templateId;
    private final String locale;
    private final Map<String, String> structuredAttributes;
    private final Instant notBefore;
    private final boolean templateOnly;
    private final long version;
    private final Instant createdAt;

    public NotificationMessage(String messageId, String tenantId, String principalId, String notificationType,
            NotificationChannel channel, String templateKey, String templateVersion, String title,
            String safeBody, String contentVersion, long version, Instant createdAt) {
        this(messageId, tenantId, principalId, notificationType, channel, templateKey, templateVersion,
                "zh-CN", Map.of(), title, safeBody, contentVersion, version, createdAt, createdAt, false);
    }

    private NotificationMessage(String messageId, String tenantId, String principalId, String notificationType,
            NotificationChannel channel, String templateKey, String templateVersion, String locale,
            Map<String, String> structuredAttributes, String title, String safeBody, String contentVersion,
            long version, Instant createdAt, Instant notBefore, boolean templateOnly) {
        this.messageId = require(messageId, "messageId");
        this.tenantId = require(tenantId, "tenantId");
        this.principalId = require(principalId, "principalId");
        this.notificationType = require(notificationType, "notificationType");
        this.channel = channel == null ? invalidChannel() : channel;
        this.templateKey = require(templateKey, "templateKey");
        this.templateVersion = require(templateVersion, "templateVersion");
        this.templateId = this.templateKey;
        this.locale = require(locale, "locale");
        this.structuredAttributes = SafeEventAttributes.copy(structuredAttributes);
        this.title = require(title, "title");
        this.safeBody = require(safeBody, "safeBody");
        this.contentVersion = require(contentVersion, "contentVersion");
        if (version < 1 || createdAt == null) {
            throw NotificationDomainException.invalid("message version and createdAt are required");
        }
        if (notBefore == null) {
            throw NotificationDomainException.invalid("notBefore is required");
        }
        if (title.length() > 160 || safeBody.length() > 4000 || locale.length() > 20) {
            throw NotificationDomainException.invalid("notification text exceeds the safe limit");
        }
        this.version = version;
        this.createdAt = createdAt;
        this.notBefore = notBefore;
        this.templateOnly = templateOnly;
    }

    /** Compatibility constructor for template-only producers. */
    public NotificationMessage(String messageId, String tenantId, String principalId, String templateKey,
            String templateVersion, String locale, NotificationChannel channel, String dedupeKey,
            Instant notBefore) {
        this(messageId, tenantId, principalId, dedupeKey, channel, templateKey, templateVersion,
                locale == null || locale.isBlank() ? "zh-CN" : locale, Map.of(), templateKey, dedupeKey,
                "v1", 1, notBefore, notBefore, true);
    }

    /** Template-only message used by trusted event consumers; it cannot carry free-form body text. */
    public static NotificationMessage trustedTemplate(String messageId, String tenantId, String principalId,
            String notificationType, NotificationChannel channel, String templateId, String templateVersion,
            String locale, Map<String, String> structuredAttributes, String contentVersion,
            long version, Instant createdAt, Instant notBefore) {
        String safeTemplateReference = require(templateId, "templateId");
        return new NotificationMessage(messageId, tenantId, principalId, notificationType, channel,
                safeTemplateReference, templateVersion, locale, structuredAttributes,
                safeTemplateReference, safeTemplateReference, contentVersion, version, createdAt, notBefore, true);
    }

    public String messageId() { return messageId; }
    public String tenantId() { return tenantId; }
    public String principalId() { return principalId; }
    public String notificationType() { return notificationType; }
    public NotificationChannel channel() { return channel; }
    public String templateKey() { return templateKey; }
    public String templateVersion() { return templateVersion; }
    public String title() { return title; }
    public String safeBody() { return safeBody; }
    public String contentVersion() { return contentVersion; }
    public String templateId() { return templateId; }
    public String locale() { return locale; }
    public Map<String, String> structuredAttributes() { return structuredAttributes; }
    public Instant notBefore() { return notBefore; }
    public boolean templateOnly() { return templateOnly; }
    public long version() { return version; }
    public Instant createdAt() { return createdAt; }
    public String dedupeKey() { return notificationType; }

    // JavaBean accessors keep HTTP JSON serialization explicit for this non-record aggregate.
    public String getMessageId() { return messageId; }
    public String getTenantId() { return tenantId; }
    public String getPrincipalId() { return principalId; }
    public String getNotificationType() { return notificationType; }
    public NotificationChannel getChannel() { return channel; }
    public String getTemplateKey() { return templateKey; }
    public String getTemplateVersion() { return templateVersion; }
    public String getTitle() { return title; }
    public String getSafeBody() { return safeBody; }
    public String getContentVersion() { return contentVersion; }
    public String getTemplateId() { return templateId; }
    public String getLocale() { return locale; }
    public Map<String, String> getStructuredAttributes() { return structuredAttributes; }
    public Instant getNotBefore() { return notBefore; }
    public boolean isTemplateOnly() { return templateOnly; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }

    private static String require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw NotificationDomainException.invalid(field + " is required");
        }
        return value;
    }

    private static NotificationChannel invalidChannel() {
        throw NotificationDomainException.invalid("channel is required");
    }
}
