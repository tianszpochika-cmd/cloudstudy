package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Local development/test store with an explicit old-digest history for replay detection. */
public final class InMemorySessionStore implements SessionStore {
    private final Map<SessionId, SessionRecord> sessions = new ConcurrentHashMap<>();
    private final Map<String, SessionId> digestIndex = new ConcurrentHashMap<>();

    @Override
    public synchronized SessionRecord save(SessionRecord session) {
        sessions.put(session.sessionId(), session);
        digestIndex.put(session.refreshTokenDigest(), session.sessionId());
        return session;
    }

    @Override public Optional<SessionRecord> find(SessionId sessionId) { return Optional.ofNullable(sessions.get(sessionId)); }

    @Override
    public Optional<SessionRecord> findByRefreshTokenDigest(String digest) {
        SessionId id = digestIndex.get(digest);
        return id == null ? Optional.empty() : Optional.ofNullable(sessions.get(id));
    }

    @Override public synchronized SessionRecord replace(SessionRecord session) {
        SessionRecord current = sessions.put(session.sessionId(), session);
        if (current != null) digestIndex.put(current.refreshTokenDigest(), session.sessionId());
        digestIndex.put(session.refreshTokenDigest(), session.sessionId());
        return session;
    }

    @Override
    public synchronized Optional<SessionRecord> replaceIfCurrent(SessionId id, long expectedRotation,
                                                                   String expectedDigest, SessionRecord replacement) {
        SessionRecord current = sessions.get(id);
        if (current == null || current.rotation() != expectedRotation
                || !SecretDigests.constantTimeEquals(current.refreshTokenDigest(), expectedDigest)
                || current.status() != SessionStatus.ACTIVE) return Optional.empty();
        sessions.put(id, replacement);
        digestIndex.put(expectedDigest, id);
        digestIndex.put(replacement.refreshTokenDigest(), id);
        return Optional.of(replacement);
    }

    @Override
    public synchronized Optional<SessionRecord> revoke(SessionId id, Instant at, String reason) {
        SessionRecord current = sessions.get(id);
        if (current == null) return Optional.empty();
        SessionRecord revoked = current.revoke(at, reason);
        sessions.put(id, revoked);
        digestIndex.put(current.refreshTokenDigest(), id);
        return Optional.of(revoked);
    }

    @Override public List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId) {
        return sessions.values().stream().filter(s -> s.principalId().equals(principalId) && s.deviceId().equals(deviceId)).toList();
    }

    @Override public List<SessionRecord> findByPrincipal(PrincipalId principalId) {
        return sessions.values().stream().filter(s -> s.principalId().equals(principalId)).toList();
    }
}
