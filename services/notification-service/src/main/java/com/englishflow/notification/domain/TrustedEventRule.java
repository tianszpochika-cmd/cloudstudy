package com.englishflow.notification.domain;

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/** Explicit event-to-template policy. Unknown fields and event hints fail closed. */
public record TrustedEventRule(
        String eventName,
        String schema,
        int version,
        String aggregateType,
        String notificationType,
        String templateId,
        String templateVersion,
        NotificationChannel channel,
        String defaultLocale,
        Set<String> allowedAttributeKeys,
        Duration deliveryDelay,
        boolean consentRequired) {

    public TrustedEventRule(String eventName, String schema, int version, String aggregateType,
            String notificationType, String templateId, String templateVersion, NotificationChannel channel,
            String defaultLocale, Set<String> allowedAttributeKeys, Duration deliveryDelay) {
        this(eventName, schema, version, aggregateType, notificationType, templateId, templateVersion,
                channel, defaultLocale, allowedAttributeKeys, deliveryDelay, true);
    }

    public TrustedEventRule {
        requireToken(eventName, "eventName", 128);
        requireToken(schema, "schema", 64);
        if (version < 1 || aggregateType == null || aggregateType.isBlank()) {
            throw NotificationDomainException.invalid("trusted event rule is incomplete");
        }
        requireToken(notificationType, "notificationType", 80);
        requireToken(templateId, "templateId", 96);
        requireToken(templateVersion, "templateVersion", 40);
        if (channel == null) throw NotificationDomainException.invalid("trusted event rule channel is required");
        requireLocale(defaultLocale);
        if (deliveryDelay == null || deliveryDelay.isNegative()) {
            throw NotificationDomainException.invalid("trusted event delivery delay is invalid");
        }
        Set<String> copy = new LinkedHashSet<>();
        if (allowedAttributeKeys != null) {
            allowedAttributeKeys.forEach(key -> {
                requireToken(key, "attribute key", 64);
                copy.add(key);
            });
        }
        allowedAttributeKeys = Set.copyOf(copy);
    }

    public Map<String, String> validate(TrustedEventEnvelope event) {
        if (!eventName.equals(event.eventName()) || !schema.equals(event.schema())
                || version != event.version() || !aggregateType.equals(event.aggregateType())) {
            throw new NotificationDomainException(NotificationDomainException.Code.TRUSTED_EVENT_REJECTED,
                    "trusted event is not allowed by the event rule");
        }
        if (event.templateId() != null && !templateId.equals(event.templateId())) {
            throw new NotificationDomainException(NotificationDomainException.Code.TEMPLATE_NOT_ALLOWED,
                    "event template is not allow-listed");
        }
        if (event.channel() != null && event.channel() != channel) {
            throw new NotificationDomainException(NotificationDomainException.Code.TRUSTED_EVENT_REJECTED,
                    "event channel is not allow-listed");
        }
        for (String key : event.attributes().keySet()) {
            if (!allowedAttributeKeys.contains(key)) {
                throw new NotificationDomainException(NotificationDomainException.Code.PAYLOAD_NOT_ALLOWED,
                        "event attribute is not allow-listed");
            }
            String value = event.attributes().get(key);
            if (!value.matches("[A-Za-z0-9][A-Za-z0-9._:/+\\-]{0,199}")) {
                throw new NotificationDomainException(NotificationDomainException.Code.PAYLOAD_NOT_ALLOWED,
                        "event attribute value is not structured");
            }
        }
        return event.attributes();
    }

    public String resolveLocale(TrustedEventEnvelope event, String preferenceLocale) {
        String candidate = preferenceLocale == null || preferenceLocale.isBlank()
                ? (event.locale() == null ? defaultLocale : event.locale()) : preferenceLocale;
        requireLocale(candidate);
        if (!candidate.equals(defaultLocale) && !candidate.equals("en-US") && !candidate.equals("zh-CN")) {
            throw new NotificationDomainException(NotificationDomainException.Code.TEMPLATE_NOT_ALLOWED,
                    "locale is not allow-listed");
        }
        return candidate;
    }

    private static void requireLocale(String value) {
        if (value == null || !value.matches("[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?")) {
            throw NotificationDomainException.invalid("locale is invalid");
        }
    }

    private static void requireToken(String value, String field, int maxLength) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0," + (maxLength - 1) + "}")) {
            throw NotificationDomainException.invalid(field + " is invalid");
        }
    }
}
