package com.englishflow.modules.user.domain;

import java.time.Instant;

/** Refresh token state; the token itself is never a field in this class. */
public final class RefreshTokenSession {

    public enum Status { ACTIVE, USED, REVOKED, EXPIRED }

    private final String tokenId;
    private final String tenantId;
    private final long userId;
    private final String devicePublicId;
    private final String familyId;
    private final String tokenHash;
    private final Status status;
    private final Instant issuedAt;
    private final Instant expiresAt;
    private final Instant usedAt;
    private final String replacedByTokenId;
    private final Instant revokedAt;
    private final String revokeReason;

    public RefreshTokenSession(
            String tokenId,
            String tenantId,
            long userId,
            String devicePublicId,
            String familyId,
            String tokenHash,
            Status status,
            Instant issuedAt,
            Instant expiresAt,
            Instant usedAt,
            String replacedByTokenId,
            Instant revokedAt,
            String revokeReason
    ) {
        this.tokenId = tokenId;
        this.tenantId = tenantId;
        this.userId = userId;
        this.devicePublicId = devicePublicId;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.status = status;
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
        this.usedAt = usedAt;
        this.replacedByTokenId = replacedByTokenId;
        this.revokedAt = revokedAt;
        this.revokeReason = revokeReason;
    }

    public String tokenId() { return tokenId; }
    public String tenantId() { return tenantId; }
    public long userId() { return userId; }
    public String devicePublicId() { return devicePublicId; }
    public String familyId() { return familyId; }
    public String tokenHash() { return tokenHash; }
    public Status status() { return status; }
    public Instant issuedAt() { return issuedAt; }
    public Instant expiresAt() { return expiresAt; }
    public Instant usedAt() { return usedAt; }
    public String replacedByTokenId() { return replacedByTokenId; }
    public Instant revokedAt() { return revokedAt; }
    public String revokeReason() { return revokeReason; }

    public RefreshTokenSession markUsed(String replacementTokenId, Instant at) {
        return new RefreshTokenSession(
                tokenId, tenantId, userId, devicePublicId, familyId, tokenHash,
                Status.USED, issuedAt, expiresAt, at, replacementTokenId,
                revokedAt, revokeReason
        );
    }

    public RefreshTokenSession revoke(String reason, Instant at) {
        return new RefreshTokenSession(
                tokenId, tenantId, userId, devicePublicId, familyId, tokenHash,
                Status.REVOKED, issuedAt, expiresAt, usedAt, replacedByTokenId,
                at, reason
        );
    }

    public RefreshTokenSession expire() {
        return new RefreshTokenSession(
                tokenId, tenantId, userId, devicePublicId, familyId, tokenHash,
                Status.EXPIRED, issuedAt, expiresAt, usedAt, replacedByTokenId,
                revokedAt, revokeReason
        );
    }

    @Override
    public String toString() {
        return "RefreshTokenSession{" +
                "tokenId='" + tokenId + '\'' +
                ", tenantId='" + tenantId + '\'' +
                ", userId=" + userId +
                ", devicePublicId='" + devicePublicId + '\'' +
                ", familyId='" + familyId + '\'' +
                ", status=" + status +
                ", issuedAt=" + issuedAt +
                ", expiresAt=" + expiresAt +
                ", usedAt=" + usedAt +
                ", replacedByTokenId='" + replacedByTokenId + '\'' +
                ", revokedAt=" + revokedAt +
                ", revokeReason='" + revokeReason + '\'' +
                '}';
    }
}
