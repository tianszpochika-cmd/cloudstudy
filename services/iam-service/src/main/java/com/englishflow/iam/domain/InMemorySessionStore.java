package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Local/test session adapter with IAM-owned state only. */
public final class InMemorySessionStore implements SessionStore {

    private final Map<SessionId, SessionRecord> sessions = new ConcurrentHashMap<>();

    @Override
    public SessionRecord save(SessionRecord session) {
        sessions.put(session.sessionId(), session);
        return session;
    }

    @Override
    public Optional<SessionRecord> find(SessionId sessionId) {
        return Optional.ofNullable(sessions.get(sessionId));
    }

    @Override
    public Optional<SessionRecord> findByRefreshTokenDigest(String refreshTokenDigest) {
        return sessions.values().stream()
                .filter(value -> SecretDigests.constantTimeEquals(value.refreshTokenDigest(), refreshTokenDigest))
                .findFirst();
    }

    @Override
    public synchronized SessionRecord replace(SessionRecord session) {
        sessions.put(session.sessionId(), session);
        return session;
    }

    @Override
    public synchronized Optional<SessionRecord> replaceIfCurrent(
            SessionId sessionId,
            long expectedRotation,
            String expectedRefreshTokenDigest,
            SessionRecord replacement) {
        SessionRecord current = sessions.get(sessionId);
        if (current == null
                || current.rotation() != expectedRotation
                || !SecretDigests.constantTimeEquals(
                current.refreshTokenDigest(), expectedRefreshTokenDigest)) {
            return Optional.empty();
        }
        sessions.put(sessionId, replacement);
        return Optional.of(replacement);
    }

    @Override
    public Optional<SessionRecord> revoke(SessionId sessionId, Instant at, String reason) {
        return Optional.ofNullable(sessions.computeIfPresent(
                sessionId,
                (ignored, value) -> value.revoke(at, reason)));
    }

    @Override
    public List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId) {
        return sessions.values().stream()
                .filter(value -> value.principalId().equals(principalId)
                        && value.deviceId().equals(deviceId))
                .toList();
    }
}
