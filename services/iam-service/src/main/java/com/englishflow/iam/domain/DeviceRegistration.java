package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/** Immutable device fact. Kicking a device writes a new revoked snapshot, never mutates history. */
public record DeviceRegistration(
        DeviceId deviceId,
        PrincipalId principalId,
        TenantScope scope,
        String platform,
        String label,
        Instant registeredAt,
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
        Objects.requireNonNull(registeredAt, "registeredAt");
    }

    public boolean active() {
        return revokedAt == null;
    }

    public DeviceRegistration revoke(Instant at) {
        Objects.requireNonNull(at, "at");
        return active() ? new DeviceRegistration(
                deviceId, principalId, scope, platform, label, registeredAt, at) : this;
    }
}
