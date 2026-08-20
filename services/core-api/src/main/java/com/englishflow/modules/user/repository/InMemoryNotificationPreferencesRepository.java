package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.domain.NotificationPreferences;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public final class InMemoryNotificationPreferencesRepository implements NotificationPreferencesRepository {

    private final ConcurrentHashMap<String, NotificationPreferences> records = new ConcurrentHashMap<>();

    @Override
    public Optional<NotificationPreferences> find(String tenantId, long userId) {
        return Optional.ofNullable(records.get(key(tenantId, userId)));
    }

    @Override
    public NotificationPreferences save(NotificationPreferences preferences) {
        records.put(key(preferences.tenantId(), preferences.userId()), preferences);
        return preferences;
    }

    private static String key(String tenantId, long userId) {
        return tenantId + "|" + userId;
    }
}
