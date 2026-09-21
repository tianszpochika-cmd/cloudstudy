package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.NotificationTemplate;
import com.englishflow.notification.port.NotificationTemplateStore;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Local/test template adapter. */
public final class InMemoryNotificationTemplateStore implements NotificationTemplateStore {

    private final Map<String, NotificationTemplate> rows = new ConcurrentHashMap<>();

    @Override
    public Optional<NotificationTemplate> findTemplate(String templateKey, String templateVersion, String locale) {
        return Optional.ofNullable(rows.get(key(templateKey, templateVersion, locale)));
    }

    @Override
    public void saveTemplate(NotificationTemplate template) {
        rows.put(key(template.templateKey(), template.templateVersion(), template.locale()), template);
    }

    private static String key(String templateKey, String templateVersion, String locale) {
        return templateKey + '|' + templateVersion + '|' + locale;
    }
}
