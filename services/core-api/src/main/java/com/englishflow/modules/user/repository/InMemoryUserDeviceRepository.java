package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.domain.UserDeviceSession;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public final class InMemoryUserDeviceRepository implements UserDeviceRepository {

    private final ConcurrentHashMap<String, UserDeviceSession> records = new ConcurrentHashMap<>();

    @Override
    public Optional<UserDeviceSession> findByPublicId(String devicePublicId) {
        return Optional.ofNullable(records.get(devicePublicId));
    }

    @Override
    public Optional<UserDeviceSession> findOwned(UserRequestContext context, String devicePublicId) {
        return findByPublicId(devicePublicId)
                .filter(session -> context.owns(session.tenantId(), session.userId()));
    }

    @Override
    public Optional<UserDeviceSession> findByOwnerAndDeviceHash(UserRequestContext context, String deviceIdHash) {
        return records.values().stream()
                .filter(session -> context.owns(session.tenantId(), session.userId()))
                .filter(session -> session.deviceIdHash().equals(deviceIdHash))
                .findFirst();
    }

    @Override
    public List<UserDeviceSession> findAllOwned(UserRequestContext context) {
        return records.values().stream()
                .filter(session -> context.owns(session.tenantId(), session.userId()))
                .sorted(Comparator.comparing(UserDeviceSession::lastActiveAt).reversed())
                .toList();
    }

    @Override
    public UserDeviceSession save(UserDeviceSession session) {
        records.put(session.devicePublicId(), session);
        return session;
    }
}
