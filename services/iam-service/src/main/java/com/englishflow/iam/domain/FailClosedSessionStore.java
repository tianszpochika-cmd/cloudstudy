package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Explicit production safety fallback when the configured durable IAM store is unavailable. */
public final class FailClosedSessionStore implements SessionStore {
    private IamPolicyException unavailable() { return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE, "iam.persistence.unavailable"); }
    @Override public SessionRecord save(SessionRecord session) { throw unavailable(); }
    @Override public Optional<SessionRecord> find(SessionId id) { throw unavailable(); }
    @Override public Optional<SessionRecord> findByRefreshTokenDigest(String digest) { throw unavailable(); }
    @Override public SessionRecord replace(SessionRecord session) { throw unavailable(); }
    @Override public Optional<SessionRecord> replaceIfCurrent(SessionId id, long rotation, String digest, SessionRecord replacement) { throw unavailable(); }
    @Override public Optional<SessionRecord> revoke(SessionId id, Instant at, String reason) { throw unavailable(); }
    @Override public List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId) { throw unavailable(); }
    @Override public List<SessionRecord> findByPrincipal(PrincipalId principalId) { throw unavailable(); }
}
