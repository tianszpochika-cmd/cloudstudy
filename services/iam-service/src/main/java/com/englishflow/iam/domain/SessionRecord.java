package com.englishflow.iam.domain;

import java.net.URI;
import java.time.Instant;
import java.util.Objects;

/** Immutable session snapshot. Refresh token material is represented only by a digest. */
public record SessionRecord(
        SessionId sessionId,
        PrincipalId principalId,
        TenantScope scope,
        DeviceId deviceId,
        URI providerIssuer,
        String providerClientId,
        ProviderSessionReference providerSessionReference,
        String refreshTokenDigest,
        long rotation,
        SessionStatus status,
        Instant createdAt,
        Instant updatedAt,
        Instant revokedAt,
        String revocationReason) {

    public SessionRecord {
        Objects.requireNonNull(sessionId, "sessionId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(scope, "scope");
        if (!principalId.equals(scope.subject())) {
            throw new IllegalArgumentException("session principal must match scope subject");
        }
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(providerIssuer, "providerIssuer");
        Objects.requireNonNull(providerClientId, "providerClientId");
        if (providerClientId.isBlank() || providerClientId.length() > 128) {
            throw new IllegalArgumentException("provider client id is invalid");
        }
        Objects.requireNonNull(providerSessionReference, "providerSessionReference");
        Objects.requireNonNull(refreshTokenDigest, "refreshTokenDigest");
        if (!refreshTokenDigest.matches("[0-9a-fA-F]{64}")) {
            throw new IllegalArgumentException("refresh token digest must be SHA-256 hex");
        }
        if (rotation < 0) {
            throw new IllegalArgumentException("rotation cannot be negative");
        }
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (status == SessionStatus.REVOKED && revokedAt == null) {
            throw new IllegalArgumentException("revoked session requires revokedAt");
        }
    }

    public SessionRecord rotate(String nextDigest, Instant at) {
        if (status != SessionStatus.ACTIVE) {
            throw new IamPolicyException(IamDecisionCode.SESSION_REVOKED, "iam.session.revoked");
        }
        Objects.requireNonNull(at, "at");
        if (!nextDigest.matches("[0-9a-fA-F]{64}")) {
            throw new IllegalArgumentException("next refresh token digest must be SHA-256 hex");
        }
        return new SessionRecord(
                sessionId,
                principalId,
                scope,
                deviceId,
                providerIssuer,
                providerClientId,
                providerSessionReference,
                nextDigest,
                rotation + 1,
                SessionStatus.ACTIVE,
                createdAt,
                at,
                null,
                null);
    }

    public SessionRecord revoke(Instant at, String reason) {
        Objects.requireNonNull(at, "at");
        Objects.requireNonNull(reason, "reason");
        if (status == SessionStatus.REVOKED) {
            return this;
        }
        return new SessionRecord(
                sessionId,
                principalId,
                scope,
                deviceId,
                providerIssuer,
                providerClientId,
                providerSessionReference,
                refreshTokenDigest,
                rotation,
                SessionStatus.REVOKED,
                createdAt,
                at,
                at,
                reason);
    }
}
