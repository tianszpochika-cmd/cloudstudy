package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/** IAM-owned refresh-token family snapshot; only a SHA-256 digest is retained. */
public record SessionRecord(
        SessionId sessionId,
        PrincipalId principalId,
        TenantScope scope,
        DeviceId deviceId,
        String tokenFamilyId,
        String refreshTokenDigest,
        long rotation,
        SessionStatus status,
        Instant createdAt,
        Instant updatedAt,
        Instant expiresAt,
        Instant revokedAt,
        String revocationReason) {

    public SessionRecord {
        Objects.requireNonNull(sessionId, "sessionId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(scope, "scope");
        if (!principalId.equals(scope.subject())) throw new IllegalArgumentException("session principal must match scope");
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(tokenFamilyId, "tokenFamilyId");
        Objects.requireNonNull(refreshTokenDigest, "refreshTokenDigest");
        if (!refreshTokenDigest.matches("[0-9a-fA-F]{64}")) throw new IllegalArgumentException("refresh digest must be SHA-256 hex");
        if (rotation < 0) throw new IllegalArgumentException("rotation cannot be negative");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        Objects.requireNonNull(expiresAt, "expiresAt");
        if (!expiresAt.isAfter(createdAt)) throw new IllegalArgumentException("session expiry must be after creation");
        if (status == SessionStatus.REVOKED && revokedAt == null) throw new IllegalArgumentException("revoked session requires revokedAt");
    }

    public SessionRecord rotate(String nextDigest, Instant at) {
        if (status != SessionStatus.ACTIVE) throw new IamPolicyException(IamDecisionCode.SESSION_REVOKED, "iam.session.revoked");
        Objects.requireNonNull(at, "at");
        if (!nextDigest.matches("[0-9a-fA-F]{64}")) throw new IllegalArgumentException("next refresh digest is invalid");
        return new SessionRecord(sessionId, principalId, scope, deviceId, tokenFamilyId, nextDigest,
                rotation + 1, SessionStatus.ACTIVE, createdAt, at, expiresAt, null, null);
    }

    public SessionRecord revoke(Instant at, String reason) {
        Objects.requireNonNull(at, "at");
        Objects.requireNonNull(reason, "reason");
        if (status == SessionStatus.REVOKED) return this;
        return new SessionRecord(sessionId, principalId, scope, deviceId, tokenFamilyId, refreshTokenDigest,
                rotation, SessionStatus.REVOKED, createdAt, at, expiresAt, at, reason);
    }
}
