package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.domain.UserDeviceSession;

import java.util.List;
import java.util.Optional;

public interface UserDeviceRepository {

    Optional<UserDeviceSession> findByPublicId(String devicePublicId);

    Optional<UserDeviceSession> findOwned(UserRequestContext context, String devicePublicId);

    Optional<UserDeviceSession> findByOwnerAndDeviceHash(UserRequestContext context, String deviceIdHash);

    List<UserDeviceSession> findAllOwned(UserRequestContext context);

    UserDeviceSession save(UserDeviceSession session);
}
