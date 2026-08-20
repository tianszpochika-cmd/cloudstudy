package com.englishflow.modules.user.domain;

import java.time.Instant;

/** Device/session state stores only hashes for device and user-agent data. */
public final class UserDeviceSession {

    public enum Status { ACTIVE, KICKED, REVOKED, EXPIRED }

    private final String tenantId;
    private final long userId;
    private final String sessionId;
    private final String devicePublicId;
    private final String deviceIdHash;
    private final String deviceType;
    private final String deviceName;
    private final String osVersion;
    private final String clientVersion;
    private final String userAgentHash;
    private final String regionCode;
    private final Status status;
    private final boolean current;
    private final Instant lastActiveAt;
    private final Instant revokedAt;
    private final String revokeReason;

    public UserDeviceSession(
            String tenantId,
            long userId,
            String sessionId,
            String devicePublicId,
            String deviceIdHash,
            String deviceType,
            String deviceName,
            String osVersion,
            String clientVersion,
            String userAgentHash,
            String regionCode,
            Status status,
            boolean current,
            Instant lastActiveAt,
            Instant revokedAt,
            String revokeReason
    ) {
        this.tenantId = tenantId;
        this.userId = userId;
        this.sessionId = sessionId;
        this.devicePublicId = devicePublicId;
        this.deviceIdHash = deviceIdHash;
        this.deviceType = deviceType;
        this.deviceName = deviceName;
        this.osVersion = osVersion;
        this.clientVersion = clientVersion;
        this.userAgentHash = userAgentHash;
        this.regionCode = regionCode;
        this.status = status;
        this.current = current;
        this.lastActiveAt = lastActiveAt;
        this.revokedAt = revokedAt;
        this.revokeReason = revokeReason;
    }

    public String tenantId() { return tenantId; }
    public long userId() { return userId; }
    public String sessionId() { return sessionId; }
    public String devicePublicId() { return devicePublicId; }
    public String deviceIdHash() { return deviceIdHash; }
    public String deviceType() { return deviceType; }
    public String deviceName() { return deviceName; }
    public String osVersion() { return osVersion; }
    public String clientVersion() { return clientVersion; }
    public String userAgentHash() { return userAgentHash; }
    public String regionCode() { return regionCode; }
    public Status status() { return status; }
    public boolean current() { return current; }
    public Instant lastActiveAt() { return lastActiveAt; }
    public Instant revokedAt() { return revokedAt; }
    public String revokeReason() { return revokeReason; }

    public UserDeviceSession withCurrent(boolean value) {
        return copy(status, value, lastActiveAt, revokedAt, revokeReason);
    }

    public UserDeviceSession touch(Instant at) {
        return copy(status, current, at, revokedAt, revokeReason);
    }

    public UserDeviceSession revoke(Status nextStatus, String reason, Instant at) {
        return copy(nextStatus, false, lastActiveAt, at, reason);
    }

    private UserDeviceSession copy(
            Status nextStatus,
            boolean nextCurrent,
            Instant nextLastActiveAt,
            Instant nextRevokedAt,
            String nextReason
    ) {
        return new UserDeviceSession(
                tenantId, userId, sessionId, devicePublicId, deviceIdHash,
                deviceType, deviceName, osVersion, clientVersion, userAgentHash,
                regionCode, nextStatus, nextCurrent, nextLastActiveAt,
                nextRevokedAt, nextReason
        );
    }

    @Override
    public String toString() {
        return "UserDeviceSession{" +
                "tenantId='" + tenantId + '\'' +
                ", userId=" + userId +
                ", sessionId='" + sessionId + '\'' +
                ", devicePublicId='" + devicePublicId + '\'' +
                ", deviceType='" + deviceType + '\'' +
                ", clientVersion='" + clientVersion + '\'' +
                ", regionCode='" + regionCode + '\'' +
                ", status=" + status +
                ", current=" + current +
                ", lastActiveAt=" + lastActiveAt +
                ", revokedAt=" + revokedAt +
                ", revokeReason='" + revokeReason + '\'' +
                '}';
    }
}
