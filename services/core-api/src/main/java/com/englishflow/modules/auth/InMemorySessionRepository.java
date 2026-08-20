package com.englishflow.modules.auth;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Repository;

/** Rebuildable in-memory session index; MySQL remains the intended authority. */
@Repository
public final class InMemorySessionRepository implements SessionRepository {

    private final ConcurrentMap<String, AuthSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> refreshHashToSession = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> accessHashToSession = new ConcurrentHashMap<>();

    @Override
    public AuthSession save(AuthSession session) {
        sessions.put(session.sessionId(), session);
        session.refreshTokenHashes().forEach(hash -> refreshHashToSession.put(hash, session.sessionId()));
        session.accessTokenHashes().forEach(hash -> accessHashToSession.put(hash, session.sessionId()));
        return session;
    }

    @Override
    public Optional<AuthSession> findById(String sessionId) {
        return Optional.ofNullable(sessions.get(sessionId));
    }

    @Override
    public Optional<AuthSession> findByRefreshTokenHash(String refreshTokenHash) {
        String sessionId = refreshHashToSession.get(refreshTokenHash);
        return sessionId == null ? Optional.empty() : findById(sessionId);
    }

    @Override
    public Optional<AuthSession> findByAccessTokenHash(String accessTokenHash) {
        String sessionId = accessHashToSession.get(accessTokenHash);
        return sessionId == null ? Optional.empty() : findById(sessionId);
    }

    @Override
    public List<AuthSession> findByUserId(long userId) {
        List<AuthSession> result = new ArrayList<>();
        for (AuthSession session : sessions.values()) {
            if (session.userId() == userId) result.add(session);
        }
        result.sort(Comparator.comparing(AuthSession::lastActiveAt).reversed());
        return result;
    }

    public int size() {
        return sessions.size();
    }
}
