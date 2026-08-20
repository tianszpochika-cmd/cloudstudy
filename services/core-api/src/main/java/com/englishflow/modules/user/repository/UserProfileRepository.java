package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.domain.UserProfile;

import java.util.Optional;

public interface UserProfileRepository {

    Optional<UserProfile> find(String tenantId, long userId);

    UserProfile save(UserProfile profile);
}
