package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Prevents sessions or revocations from being accepted without a durable IAM store. */
public final class FailClosedSessionStore implements SessionStore {

    @Override
    public SessionRecord save(SessionRecord session) {
        throw unavailable();
    }

    @Override
    public Optional<SessionRecord> find(SessionId sessionId) {
        throw unavailable();
    }

    @Override
    public Optional<SessionRecord> findByRefreshTokenDigest(String refreshTokenDigest) {
        throw unavailable();
    }

    @Override
    public SessionRecord replace(SessionRecord session) {
        throw unavailable();
    }

    @Override
    public Optional<SessionRecord> replaceIfCurrent(
            SessionId sessionId,
            long expectedRotation,
            String expectedRefreshTokenDigest,
            SessionRecord replacement) {
        throw unavailable();
    }

    @Override
    public Optional<SessionRecord> revoke(SessionId sessionId, Instant at, String reason) {
        throw unavailable();
    }

    @Override
    public List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId) {
        throw unavailable();
    }

    private IamPolicyException unavailable() {
        return new IamPolicyException(
                IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
