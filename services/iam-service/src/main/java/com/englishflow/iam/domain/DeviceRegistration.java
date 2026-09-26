package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/** Device fact. The timestamp is the latest successful device authentication, not request activity. */
public record DeviceRegistration(
        DeviceId deviceId,
        PrincipalId principalId,
        TenantScope scope,
        String platform,
        String label,
        Instant lastAuthenticatedAt,
        Instant revokedAt) {

    public DeviceRegistration {
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(scope, "scope");
        if (!principalId.equals(scope.subject())) {
            throw new IllegalArgumentException("device owner must be the server-derived subject");
        }
        Objects.requireNonNull(platform, "platform");
        Objects.requireNonNull(label, "label");
        Objects.requireNonNull(lastAuthenticatedAt, "lastAuthenticatedAt");
    }

    public boolean active() {
        return revokedAt == null;
    }

    public DeviceRegistration revoke(Instant at) {
        Objects.requireNonNull(at, "at");
        return active() ? new DeviceRegistration(
                deviceId, principalId, scope, platform, label, lastAuthenticatedAt, at) : this;
    }
}
