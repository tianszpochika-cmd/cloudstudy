package com.englishflow.notification.domain;

import java.util.Objects;
import java.util.Set;

/** Verified IAM/session facts; client payload cannot override tenant or owner. */
public final class NotificationPrincipalContext {

    private final String tenantId;
    private final String principalId;
    private final String deviceId;
    private final Set<String> roles;
    private final Set<String> permissions;
    private final boolean authenticated;
    private final boolean consentGranted;
    private final boolean revoked;

    public NotificationPrincipalContext(String tenantId, String principalId, String deviceId,
            Set<String> roles, Set<String> permissions) {
        this(tenantId, principalId, deviceId, roles, permissions, true, true, false);
    }

    /** Compatibility constructor for direct smoke fixtures; HTTP never uses client identity fields. */
    public NotificationPrincipalContext(String tenantId, String principalId, String deviceId,
            boolean authenticated, boolean consentGranted, boolean revoked) {
        this(tenantId, principalId, deviceId, Set.of(), Set.of(), authenticated, consentGranted, revoked);
    }

    private NotificationPrincipalContext(String tenantId, String principalId, String deviceId,
            Set<String> roles, Set<String> permissions, boolean authenticated,
            boolean consentGranted, boolean revoked) {
        this.tenantId = required(tenantId, "tenantId");
        this.principalId = required(principalId, "principalId");
        this.deviceId = required(deviceId, "deviceId");
        this.roles = Set.copyOf(Objects.requireNonNull(roles, "roles"));
        this.permissions = Set.copyOf(Objects.requireNonNull(permissions, "permissions"));
        this.authenticated = authenticated;
        this.consentGranted = consentGranted;
        this.revoked = revoked;
    }

    public static NotificationPrincipalContext phaseOne(String principalId, String deviceId) {
        return new NotificationPrincipalContext("phase1", principalId, deviceId,
                Set.of("learner"), Set.of("notification.read", "notification.write", "sync.write",
                        "notification.preference.read.self", "notification.preference.write.self"));
    }

    public static NotificationPrincipalContext authenticated(String tenantId, String principalId, String deviceId) {
        return new NotificationPrincipalContext(tenantId, principalId, deviceId,
                Set.of("learner"), Set.of("notification.read", "notification.write", "sync.write",
                        "notification.preference.read.self", "notification.preference.write.self"));
    }

    public static NotificationPrincipalContext trustedService(String tenantId, String servicePrincipalId) {
        return new NotificationPrincipalContext(tenantId, servicePrincipalId, "service-worker",
                Set.of("service"), Set.of("notification.event.consume", "notification.retry"));
    }

    public String tenantId() { return tenantId; }
    public String principalId() { return principalId; }
    public String deviceId() { return deviceId; }
    public Set<String> roles() { return roles; }
    public Set<String> permissions() { return permissions; }
    public boolean authenticated() { return authenticated; }
    public boolean consentGranted() { return consentGranted; }
    public boolean revoked() { return revoked; }

    public boolean owns(String tenant, String principal) {
        return tenantId.equals(tenant) && principalId.equals(principal);
    }

    public boolean hasPermission(String permission) {
        return permissions.contains(permission);
    }

    public void requireActive() {
        requireAuthenticated();
        if (!consentGranted) {
            throw new NotificationDomainException(NotificationDomainException.Code.FORBIDDEN,
                    "notification/sync consent is required");
        }
    }

    /**
     * Workload and operator commands are authenticated by IAM permissions, not
     * by a learner's notification-consent flag. Recipient consent is checked
     * by the notification use case before a message is queued or sent.
     */
    public void requireAuthenticated() {
        if (!authenticated) {
            throw new NotificationDomainException(NotificationDomainException.Code.UNAUTHORIZED,
                    "verified principal is required");
        }
        if (revoked) {
            throw new NotificationDomainException(NotificationDomainException.Code.FORBIDDEN,
                    "principal or device is revoked");
        }
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 128) {
            throw NotificationDomainException.invalid(field + " is invalid");
        }
        return value.trim();
    }
}
