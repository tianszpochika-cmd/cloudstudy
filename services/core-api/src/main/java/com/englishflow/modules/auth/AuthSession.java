package com.englishflow.modules.auth;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Device session plus one refresh-token family. All mutations are serialized
 * on this object so two concurrent refresh requests cannot both succeed.
 */
public final class AuthSession {

    private final String sessionId;
    private final long userId;
    private final String deviceId;
    private final String deviceType;
    private final String deviceName;
    private final String osVersion;
    private final String clientVersion;
    private final String regionCode;
    private final Instant createdAt;
    private final Instant expiresAt;
    private final Map<String, RefreshTokenRecord> refreshTokensByHash = new LinkedHashMap<>();
    private final Map<String, Instant> accessTokenExpiriesByHash = new LinkedHashMap<>();
    private SessionStatus status = SessionStatus.ACTIVE;
    private TokenFamilyStatus tokenFamilyStatus = TokenFamilyStatus.ACTIVE;
    private Instant lastActiveAt;
    private Instant revokedAt;
    private String revokeReason;

    public AuthSession(
            String sessionId,
            long userId,
            DeviceInput device,
            Instant createdAt,
            Instant expiresAt
    ) {
        device.validate();
        this.sessionId = sessionId;
        this.userId = userId;
        this.deviceId = device.deviceId();
        this.deviceType = device.normalizedDeviceType();
        this.deviceName = device.deviceName();
        this.osVersion = device.osVersion();
        this.clientVersion = device.clientVersion();
        this.regionCode = device.regionCode();
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.lastActiveAt = createdAt;
    }

    public String sessionId() {
        return sessionId;
    }

    public long userId() {
        return userId;
    }

    public String deviceId() {
        return deviceId;
    }

    public String deviceType() {
        return deviceType;
    }

    public String deviceName() {
        return deviceName;
    }

    public String osVersion() {
        return osVersion;
    }

    public String clientVersion() {
        return clientVersion;
    }

    public String regionCode() {
        return regionCode;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    public synchronized SessionStatus status() {
        return status;
    }

    public synchronized TokenFamilyStatus tokenFamilyStatus() {
        return tokenFamilyStatus;
    }

    public synchronized Instant lastActiveAt() {
        return lastActiveAt;
    }

    public synchronized Instant revokedAt() {
        return revokedAt;
    }

    public synchronized String revokeReason() {
        return revokeReason;
    }

    public synchronized void touch(Instant at) {
        if (status == SessionStatus.ACTIVE) {
            lastActiveAt = at;
        }
    }

    public synchronized void addAccessToken(String tokenHash, Instant expiresAt) {
        accessTokenExpiriesByHash.put(tokenHash, expiresAt);
    }

    public synchronized void addRefreshToken(RefreshTokenRecord record) {
        refreshTokensByHash.put(record.tokenHash(), record);
    }

    public synchronized RefreshTokenRecord refreshToken(String tokenHash) {
        return refreshTokensByHash.get(tokenHash);
    }

    public synchronized Instant accessTokenExpiry(String tokenHash) {
        return accessTokenExpiriesByHash.get(tokenHash);
    }

    public synchronized Set<String> refreshTokenHashes() {
        return Set.copyOf(refreshTokensByHash.keySet());
    }

    public synchronized Set<String> accessTokenHashes() {
        return Set.copyOf(accessTokenExpiriesByHash.keySet());
    }

    public synchronized boolean markExpiredIfDue(Instant now) {
        if (status == SessionStatus.ACTIVE && !now.isBefore(expiresAt)) {
            status = AuthStateMachine.transition(status, AuthStateMachine.SessionTransition.EXPIRE);
            tokenFamilyStatus = AuthStateMachine.expireFamily(tokenFamilyStatus);
            refreshTokensByHash.values().forEach(RefreshTokenRecord::markExpired);
            return true;
        }
        return false;
    }

    public synchronized void revoke(String reason, boolean kicked, boolean reuseDetected, Instant at) {
        AuthStateMachine.SessionTransition transition = kicked
                ? AuthStateMachine.SessionTransition.KICK
                : AuthStateMachine.SessionTransition.REVOKE;
        status = AuthStateMachine.transition(status, transition);
        tokenFamilyStatus = AuthStateMachine.revokeFamily(tokenFamilyStatus, reuseDetected);
        revokedAt = revokedAt == null ? at : revokedAt;
        revokeReason = revokeReason == null ? reason : revokeReason;
        refreshTokensByHash.values().forEach(token -> token.markRevoked(at));
    }

    public synchronized void markRefreshExpired(RefreshTokenRecord record) {
        record.markExpired();
        if (tokenFamilyStatus == TokenFamilyStatus.ACTIVE && !record.expiresAt().isAfter(expiresAt)) {
            tokenFamilyStatus = AuthStateMachine.expireFamily(tokenFamilyStatus);
        }
    }

    public synchronized List<RefreshTokenRecord> refreshTokenRecords() {
        return new ArrayList<>(refreshTokensByHash.values());
    }

    public synchronized List<String> activeAccessTokenHashes() {
        List<String> active = new ArrayList<>();
        for (Map.Entry<String, Instant> entry : accessTokenExpiriesByHash.entrySet()) {
            if (entry.getValue().isAfter(Instant.now())) {
                active.add(entry.getKey());
            }
        }
        return active;
    }

    @Override
    public String toString() {
        return "AuthSession{" +
                "sessionId='" + sessionId + '\'' +
                ", userId=" + userId +
                ", deviceType='" + deviceType + '\'' +
                ", status=" + status() +
                ", tokenFamilyStatus=" + tokenFamilyStatus() +
                '}';
    }
}
