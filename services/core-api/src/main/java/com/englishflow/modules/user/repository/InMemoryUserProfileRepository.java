package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.domain.UserProfile;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public final class InMemoryUserProfileRepository implements UserProfileRepository {

    private final ConcurrentHashMap<String, UserProfile> records = new ConcurrentHashMap<>();

    @Override
    public Optional<UserProfile> find(String tenantId, long userId) {
        return Optional.ofNullable(records.get(key(tenantId, userId)));
    }

    @Override
    public UserProfile save(UserProfile profile) {
        records.put(key(profile.tenantId(), profile.userId()), profile);
        return profile;
    }

    private static String key(String tenantId, long userId) {
        return tenantId + "|" + userId;
    }
}
