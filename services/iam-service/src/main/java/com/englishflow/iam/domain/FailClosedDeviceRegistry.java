package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Explicitly closed device boundary when IAM durable persistence is not configured. */
public final class FailClosedDeviceRegistry implements DeviceRegistryPort {
    private IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
    @Override public DeviceRegistration save(DeviceRegistration registration) { throw unavailable(); }
    @Override public Optional<DeviceRegistration> find(PrincipalId principalId, DeviceId deviceId) { throw unavailable(); }
    @Override public List<DeviceRegistration> findByPrincipal(PrincipalId principalId) { throw unavailable(); }
    @Override public List<DeviceRegistration> history(PrincipalId principalId, DeviceId deviceId) { throw unavailable(); }
    @Override public Optional<DeviceRegistration> revoke(PrincipalId principalId, DeviceId deviceId, Instant at) { throw unavailable(); }
}
