package com.englishflow.notification.domain;

import java.util.Objects;
import java.util.Set;

/** Default-deny owner/tenant policy for the service-owned facts. */
public final class NotificationAccessPolicy {

    public void requireOwner(NotificationPrincipalContext context, String tenantId, String principalId) {
        if (context == null) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.UNAUTHORIZED, "verified principal is required");
        }
        context.requireActive();
        if (!context.owns(tenantId, principalId)) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.FORBIDDEN, "resource is outside the principal scope");
        }
    }

    public void requirePermission(NotificationPrincipalContext context, String permission) {
        if (context == null) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.UNAUTHORIZED, "verified principal is required");
        }
        context.requireActive();
        if (!context.hasPermission(Objects.requireNonNull(permission, "permission"))) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.FORBIDDEN, "permission is not granted");
        }
    }

    public void requireAnyPermission(NotificationPrincipalContext context, Set<String> permissions) {
        if (context == null) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.UNAUTHORIZED, "verified principal is required");
        }
        context.requireActive();
        if (permissions == null || permissions.isEmpty()
                || permissions.stream().noneMatch(context::hasPermission)) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.FORBIDDEN, "permission is not granted");
        }
    }

    public void requireTrustedEventConsumer(NotificationPrincipalContext context) {
        requireWorkloadPermission(context, "notification.event.consume");
    }

    public void requireTrustedEventConsumer(NotificationPrincipalContext context, String tenantId) {
        requireTrustedEventConsumer(context);
        requireTenant(context, tenantId);
    }

    public void requireRetryWorker(NotificationPrincipalContext context) {
        requireWorkloadPermission(context, "notification.retry");
    }

    public void requireRetryWorker(NotificationPrincipalContext context, String tenantId) {
        requireRetryWorker(context);
        requireTenant(context, tenantId);
    }

    public void requireManualRecovery(NotificationPrincipalContext context) {
        requireAnyWorkloadPermission(context, Set.of("notification.recovery", "admin.recovery.command"));
    }

    public void requireManualRecovery(NotificationPrincipalContext context, String tenantId) {
        requireManualRecovery(context);
        requireTenant(context, tenantId);
    }

    public void requireRecoveryRead(NotificationPrincipalContext context) {
        requireAnyWorkloadPermission(context, Set.of("notification.recovery", "admin.recovery.read"));
    }

    public void requireTrustedNotificationWriter(NotificationPrincipalContext context, String tenantId) {
        requireAnyWorkloadPermission(context,
                Set.of("notification.event.consume", "notification.recovery"));
        requireTenant(context, tenantId);
    }

    private void requireWorkloadPermission(NotificationPrincipalContext context, String permission) {
        if (context == null) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.UNAUTHORIZED, "verified principal is required");
        }
        context.requireAuthenticated();
        if (!context.hasPermission(Objects.requireNonNull(permission, "permission"))) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.FORBIDDEN, "permission is not granted");
        }
    }

    private void requireAnyWorkloadPermission(NotificationPrincipalContext context, Set<String> permissions) {
        if (context == null) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.UNAUTHORIZED, "verified principal is required");
        }
        context.requireAuthenticated();
        if (permissions == null || permissions.isEmpty()
                || permissions.stream().noneMatch(context::hasPermission)) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.FORBIDDEN, "permission is not granted");
        }
    }

    private static void requireTenant(NotificationPrincipalContext context, String tenantId) {
        if (tenantId == null || tenantId.isBlank() || !context.tenantId().equals(tenantId)) {
            throw new NotificationDomainException(
                    NotificationDomainException.Code.FORBIDDEN, "resource is outside the principal scope");
        }
    }
}
