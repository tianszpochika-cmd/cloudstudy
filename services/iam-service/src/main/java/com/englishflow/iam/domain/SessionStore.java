package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SessionStore {

    SessionRecord save(SessionRecord session);

    Optional<SessionRecord> find(SessionId sessionId);

    SessionRecord replace(SessionRecord session);

    Optional<SessionRecord> revoke(SessionId sessionId, Instant at, String reason);

    List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId);
}
