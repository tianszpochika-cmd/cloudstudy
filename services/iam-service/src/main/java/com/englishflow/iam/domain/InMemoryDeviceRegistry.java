package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;

/** Local/test adapter for IAM-owned device facts; never writes core-api or another service schema. */
public final class InMemoryDeviceRegistry implements DeviceRegistryPort {

    private final Map<String, DeviceRegistration> registrations = new ConcurrentHashMap<>();
    private final Map<String, List<DeviceRegistration>> history = new ConcurrentHashMap<>();

    @Override
    public synchronized DeviceRegistration save(DeviceRegistration registration) {
        String key = key(registration.principalId(), registration.deviceId());
        registrations.put(key, registration);
        history.computeIfAbsent(key, ignored -> new ArrayList<>()).add(registration);
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
    public synchronized Optional<DeviceRegistration> revoke(PrincipalId principalId, DeviceId deviceId, Instant at) {
        String key = key(principalId, deviceId);
        DeviceRegistration current = registrations.get(key);
        if (current == null) {
            return Optional.empty();
        }
        DeviceRegistration revoked = current.revoke(at);
        registrations.put(key, revoked);
        history.computeIfAbsent(key, ignored -> new ArrayList<>()).add(revoked);
        return Optional.of(revoked);
    }

    @Override
    public synchronized List<DeviceRegistration> history(PrincipalId principalId, DeviceId deviceId) {
        return List.copyOf(history.getOrDefault(key(principalId, deviceId), List.of()));
    }

    private static String key(PrincipalId principalId, DeviceId deviceId) {
        return principalId + ":" + deviceId.value();
    }
}
