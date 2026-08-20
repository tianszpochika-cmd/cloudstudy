package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.domain.PrivacySettings;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public final class InMemoryPrivacySettingsRepository implements PrivacySettingsRepository {

    private final ConcurrentHashMap<String, PrivacySettings> records = new ConcurrentHashMap<>();

    @Override
    public Optional<PrivacySettings> find(String tenantId, long userId) {
        return Optional.ofNullable(records.get(key(tenantId, userId)));
    }

    @Override
    public PrivacySettings save(PrivacySettings settings) {
        records.put(key(settings.tenantId(), settings.userId()), settings);
        return settings;
    }

    private static String key(String tenantId, long userId) {
        return tenantId + "|" + userId;
    }
}
