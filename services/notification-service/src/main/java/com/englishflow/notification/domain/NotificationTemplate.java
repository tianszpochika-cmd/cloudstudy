package com.englishflow.notification.domain;

import java.time.Instant;
import java.util.Objects;

/** M6-001 managed template fact: key + version + locale, ACTIVE or RETIRED. */
public final class NotificationTemplate {

    public enum TemplateStatus { ACTIVE, RETIRED }

    private final String templateKey;
    private final String templateVersion;
    private final String locale;
    private final String titleTemplate;
    private final String bodyTemplate;
    private final TemplateStatus status;
    private final Instant updatedAt;

    public NotificationTemplate(String templateKey, String templateVersion, String locale,
            String titleTemplate, String bodyTemplate, TemplateStatus status, Instant updatedAt) {
        this.templateKey = token(templateKey, "templateKey", 128);
        this.templateVersion = token(templateVersion, "templateVersion", 40);
        this.locale = token(locale, "locale", 20);
        this.titleTemplate = token(titleTemplate, "titleTemplate", 160);
        this.bodyTemplate = token(bodyTemplate, "bodyTemplate", 4000);
        this.status = Objects.requireNonNull(status, "status is required");
        this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    public NotificationTemplate retired(Instant retiredAt) {
        return new NotificationTemplate(templateKey, templateVersion, locale,
                titleTemplate, bodyTemplate, TemplateStatus.RETIRED,
                Objects.requireNonNull(retiredAt, "retiredAt is required"));
    }

    public String templateKey() { return templateKey; }
    public String templateVersion() { return templateVersion; }
    public String locale() { return locale; }
    public String titleTemplate() { return titleTemplate; }
    public String bodyTemplate() { return bodyTemplate; }
    public TemplateStatus status() { return status; }
    public Instant updatedAt() { return updatedAt; }

    private static String token(String value, String field, int max) {
        if (value == null || value.isBlank() || value.length() > max) {
            throw NotificationDomainException.invalid(field + " is invalid");
        }
        return value.trim();
    }
}
