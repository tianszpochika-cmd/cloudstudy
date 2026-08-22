package com.englishflow.iam.domain;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Device registration and kick-out service scoped to the server-derived principal. */
public final class DeviceService {

    private final DeviceRegistryPort devices;
    private final AuditFactPort audit;
    private final Clock clock;

    public DeviceService(DeviceRegistryPort devices, AuditFactPort audit, Clock clock) {
        this.devices = Objects.requireNonNull(devices, "devices");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public DeviceRegistration register(
            ServerPrincipalContext context,
            DeviceRegistrationCommand command) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(command, "command");
        context.rejectClientAuthority(command.clientAuthorityClaims());
        DeviceRegistration registration = new DeviceRegistration(
                command.deviceId(),
                context.principalId(),
                context.scope(),
                command.platform(),
                command.label(),
                Instant.now(clock),
                null);
        DeviceRegistration saved = devices.save(registration);
        appendAudit(context.scope(), IamDecisionCode.DEVICE_REGISTERED, "device_registered");
        return saved;
    }

    public List<DeviceRegistration> list(ServerPrincipalContext context) {
        Objects.requireNonNull(context, "context");
        return devices.findByPrincipal(context.principalId()).stream()
                .filter(value -> value.scope().equals(context.scope()))
                .toList();
    }

    public DeviceRegistration kick(ServerPrincipalContext context, DeviceId deviceId) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(deviceId, "deviceId");
        DeviceRegistration registration = devices.find(context.principalId(), deviceId)
                .orElseThrow(() -> new IamPolicyException(
                        IamDecisionCode.DEVICE_NOT_FOUND,
                        "iam.device.not_found"));
        DeviceRegistration revoked = devices.revoke(context.principalId(), deviceId, Instant.now(clock))
                .orElseThrow(() -> new IamPolicyException(
                        IamDecisionCode.DEVICE_NOT_FOUND,
                        "iam.device.not_found"));
        if (registration.active()) {
            appendAudit(context.scope(), IamDecisionCode.DEVICE_REVOKED, "device_kicked");
        }
        return revoked;
    }

    private void appendAudit(TenantScope scope, IamDecisionCode code, String type) {
        try {
            audit.append(AuditDecision.of(type, code, true, scope, Instant.now(clock),
                    java.util.Set.of(), java.util.Set.of()));
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
    }
}
