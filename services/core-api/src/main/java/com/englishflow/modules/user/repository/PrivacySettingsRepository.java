package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.domain.PrivacySettings;

import java.util.Optional;

public interface PrivacySettingsRepository {

    Optional<PrivacySettings> find(String tenantId, long userId);

    PrivacySettings save(PrivacySettings settings);
}
