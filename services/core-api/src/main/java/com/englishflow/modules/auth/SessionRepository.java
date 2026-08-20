package com.englishflow.modules.auth;

import java.util.List;
import java.util.Optional;

/** Persistence boundary for device sessions and token hashes. */
public interface SessionRepository {
    AuthSession save(AuthSession session);

    Optional<AuthSession> findById(String sessionId);

    Optional<AuthSession> findByRefreshTokenHash(String refreshTokenHash);

    Optional<AuthSession> findByAccessTokenHash(String accessTokenHash);

    List<AuthSession> findByUserId(long userId);
}
