package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SessionStore {

    SessionRecord save(SessionRecord session);

    Optional<SessionRecord> find(SessionId sessionId);

    Optional<SessionRecord> findByRefreshTokenDigest(String refreshTokenDigest);

    SessionRecord replace(SessionRecord session);

    /**
     * Cross-process-safe compare-and-set. Production implementations must persist this as a
     * conditional update on session id, rotation and refresh digest, not as a JVM-only lock.
     */
    Optional<SessionRecord> replaceIfCurrent(
            SessionId sessionId,
            long expectedRotation,
            String expectedRefreshTokenDigest,
            SessionRecord replacement);

    Optional<SessionRecord> revoke(SessionId sessionId, Instant at, String reason);

    List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId);
}
