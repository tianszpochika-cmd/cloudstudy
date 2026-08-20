package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.domain.RefreshTokenSession;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository {

    Optional<RefreshTokenSession> findByTokenHash(String tokenHash);

    List<RefreshTokenSession> findByOwnerAndDevice(UserRequestContext context, String devicePublicId);

    List<RefreshTokenSession> findByFamily(String familyId);

    RefreshTokenSession save(RefreshTokenSession session);
}
