package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.domain.NotificationPreferences;

import java.util.Optional;

public interface NotificationPreferencesRepository {

    Optional<NotificationPreferences> find(String tenantId, long userId);

    NotificationPreferences save(NotificationPreferences preferences);
}
