package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.domain.RefreshTokenSession;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public final class InMemoryRefreshTokenRepository implements RefreshTokenRepository {

    private final ConcurrentHashMap<String, RefreshTokenSession> records = new ConcurrentHashMap<>();

    @Override
    public Optional<RefreshTokenSession> findByTokenHash(String tokenHash) {
        return Optional.ofNullable(records.get(tokenHash));
    }

    @Override
    public List<RefreshTokenSession> findByOwnerAndDevice(UserRequestContext context, String devicePublicId) {
        return records.values().stream()
                .filter(session -> context.owns(session.tenantId(), session.userId()))
                .filter(session -> devicePublicId.equals(session.devicePublicId()))
                .toList();
    }

    @Override
    public List<RefreshTokenSession> findByFamily(String familyId) {
        return records.values().stream()
                .filter(session -> session.familyId().equals(familyId))
                .toList();
    }

    @Override
    public RefreshTokenSession save(RefreshTokenSession session) {
        records.put(session.tokenHash(), session);
        return session;
    }
}
