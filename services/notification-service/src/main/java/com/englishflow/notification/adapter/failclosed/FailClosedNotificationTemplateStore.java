package com.englishflow.notification.adapter.failclosed;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationTemplate;
import com.englishflow.notification.port.NotificationTemplateStore;

import java.util.Optional;

/** Missing template storage is unavailable, never an implicit renderable template. */
public final class FailClosedNotificationTemplateStore implements NotificationTemplateStore {

    @Override
    public Optional<NotificationTemplate> findTemplate(String templateKey, String templateVersion, String locale) {
        throw new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification template persistence is not configured");
    }

    @Override
    public void saveTemplate(NotificationTemplate template) {
        throw new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification template persistence is not configured");
    }
}
