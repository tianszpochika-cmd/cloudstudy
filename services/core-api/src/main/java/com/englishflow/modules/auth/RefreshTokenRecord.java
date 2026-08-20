package com.englishflow.modules.auth;

import java.time.Instant;

/** Server-side refresh record. The raw token is never a field of this type. */
public final class RefreshTokenRecord {

    private final String tokenId;
    private final String tokenHash;
    private final Instant issuedAt;
    private final Instant expiresAt;
    private RefreshTokenStatus status;
    private Instant usedAt;
    private String replacedByTokenId;
    private Instant revokedAt;

    public RefreshTokenRecord(String tokenId, String tokenHash, Instant issuedAt, Instant expiresAt) {
        this.tokenId = tokenId;
        this.tokenHash = tokenHash;
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
        this.status = RefreshTokenStatus.ACTIVE;
    }

    public String tokenId() {
        return tokenId;
    }

    String tokenHash() {
        return tokenHash;
    }

    public Instant issuedAt() {
        return issuedAt;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    public RefreshTokenStatus status() {
        return status;
    }

    public Instant usedAt() {
        return usedAt;
    }

    public String replacedByTokenId() {
        return replacedByTokenId;
    }

    public Instant revokedAt() {
        return revokedAt;
    }

    void markRotated(Instant at, String replacementId) {
        status = RefreshTokenStatus.ROTATED;
        usedAt = at;
        replacedByTokenId = replacementId;
    }

    void markRevoked(Instant at) {
        if (status != RefreshTokenStatus.ROTATED) {
            status = RefreshTokenStatus.REVOKED;
        }
        revokedAt = at;
    }

    void markExpired() {
        if (status == RefreshTokenStatus.ACTIVE) {
            status = RefreshTokenStatus.EXPIRED;
        }
    }
}
