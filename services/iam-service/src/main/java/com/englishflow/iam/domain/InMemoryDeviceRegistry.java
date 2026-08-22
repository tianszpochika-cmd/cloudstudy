package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Local/test adapter for IAM-owned device facts; never writes core-api or another service schema. */
public final class InMemoryDeviceRegistry implements DeviceRegistryPort {

    private final Map<String, DeviceRegistration> registrations = new ConcurrentHashMap<>();

    @Override
    public DeviceRegistration save(DeviceRegistration registration) {
        String key = key(registration.principalId(), registration.deviceId());
        registrations.put(key, registration);
        return registration;
    }

    @Override
    public Optional<DeviceRegistration> find(PrincipalId principalId, DeviceId deviceId) {
        return Optional.ofNullable(registrations.get(key(principalId, deviceId)));
    }

    @Override
    public List<DeviceRegistration> findByPrincipal(PrincipalId principalId) {
        return registrations.values().stream()
                .filter(value -> value.principalId().equals(principalId))
                .map(value -> value)
                .toList();
    }

    @Override
    public Optional<DeviceRegistration> revoke(PrincipalId principalId, DeviceId deviceId, Instant at) {
        String key = key(principalId, deviceId);
        return Optional.ofNullable(registrations.computeIfPresent(key, (ignored, value) -> value.revoke(at)));
    }

    private static String key(PrincipalId principalId, DeviceId deviceId) {
        return principalId + ":" + deviceId.value();
    }
}
