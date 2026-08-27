package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * IAM-owned device persistence boundary. Register/revoke operations append immutable snapshots;
 * find methods expose the current projection for self-scoped reads.
 */
public interface DeviceRegistryPort {

    DeviceRegistration save(DeviceRegistration registration);

    Optional<DeviceRegistration> find(PrincipalId principalId, DeviceId deviceId);

    List<DeviceRegistration> findByPrincipal(PrincipalId principalId);

    List<DeviceRegistration> history(PrincipalId principalId, DeviceId deviceId);

    Optional<DeviceRegistration> revoke(PrincipalId principalId, DeviceId deviceId, Instant at);
}
