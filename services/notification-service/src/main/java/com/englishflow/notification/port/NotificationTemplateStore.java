package com.englishflow.notification.port;

import com.englishflow.notification.domain.NotificationTemplate;

import java.util.Optional;

/** Managed template facts (M6-001). Only ACTIVE rows may render template-only messages. */
public interface NotificationTemplateStore {

    Optional<NotificationTemplate> findTemplate(String templateKey, String templateVersion, String locale);

    /**
     * Active template lookup with locale fallback: exact locale first, then zh-CN.
     * A retired or missing template resolves empty so delivery fails closed.
     */
    default Optional<NotificationTemplate> findActive(String templateKey, String templateVersion, String locale) {
        Optional<NotificationTemplate> exact = findTemplate(templateKey, templateVersion,
                locale == null || locale.isBlank() ? "zh-CN" : locale.trim());
        if (exact.isPresent()) {
            return exact.filter(template -> template.status() == NotificationTemplate.TemplateStatus.ACTIVE);
        }
        return findTemplate(templateKey, templateVersion, "zh-CN")
                .filter(template -> template.status() == NotificationTemplate.TemplateStatus.ACTIVE);
    }

    void saveTemplate(NotificationTemplate template);
}
