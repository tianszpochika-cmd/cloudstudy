package com.englishflow.notification.unit;

import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Default-deny owner/tenant and workload-authorization policy. */
class NotificationAccessPolicyTest {

    private final NotificationAccessPolicy access = new NotificationAccessPolicy();

    private static NotificationPrincipalContext learner() {
        return NotificationPrincipalContext.authenticated("tenant-a", "prn-1", "dev-1");
    }

    private static NotificationPrincipalContext noPermission() {
        return new NotificationPrincipalContext("tenant-a", "prn-1", "dev-1", Set.of("learner"), Set.of());
    }

    private static NotificationPrincipalContext consumer() {
        return new NotificationPrincipalContext("tenant-a", "svc", "dev-svc", Set.of("service"),
                Set.of("notification.event.consume", "notification.retry"));
    }

    private static NotificationPrincipalContext operator() {
        return new NotificationPrincipalContext("tenant-a", "ops", "dev-ops", Set.of("operator"),
                Set.of("notification.recovery"));
    }

    private static NotificationPrincipalContext revoked() {
        return new NotificationPrincipalContext("tenant-a", "prn-1", "dev-1", true, true, true);
    }

    @Test
    void requireOwnerAllowsSelfAndDeniesOther() {
        access.requireOwner(learner(), "tenant-a", "prn-1");
        var ex = assertThrows(NotificationDomainException.class, () -> access.requireOwner(learner(), "tenant-a", "prn-2"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
        var exTenant = assertThrows(NotificationDomainException.class, () -> access.requireOwner(learner(), "tenant-b", "prn-1"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, exTenant.code());
    }

    @Test
    void requirePermissionDeniesMissingAndNullContext() {
        access.requirePermission(learner(), "notification.read");
        var ex = assertThrows(NotificationDomainException.class, () -> access.requirePermission(noPermission(), "notification.read"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
        var nullEx = assertThrows(NotificationDomainException.class, () -> access.requirePermission(null, "notification.read"));
        assertEquals(NotificationDomainException.Code.UNAUTHORIZED, nullEx.code());
    }

    @Test
    void requireAnyPermissionNeedsAtLeastOne() {
        access.requireAnyPermission(operator(), Set.of("notification.recovery", "admin.recovery.command"));
        var ex = assertThrows(NotificationDomainException.class, () -> access.requireAnyPermission(noPermission(), Set.of("a", "b")));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
        assertThrows(NotificationDomainException.class, () -> access.requireAnyPermission(learner(), Set.of()));
    }

    @Test
    void trustedEventConsumerRequiresPermissionAndTenant() {
        access.requireTrustedEventConsumer(consumer());
        access.requireTrustedEventConsumer(consumer(), "tenant-a");
        var ex = assertThrows(NotificationDomainException.class, () -> access.requireTrustedEventConsumer(learner(), "tenant-a"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
        var exTenant = assertThrows(NotificationDomainException.class, () -> access.requireTrustedEventConsumer(consumer(), "tenant-b"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, exTenant.code());
    }

    @Test
    void retryWorkerRequiresPermissionAndTenant() {
        access.requireRetryWorker(consumer());
        access.requireRetryWorker(consumer(), "tenant-a");
        var ex = assertThrows(NotificationDomainException.class, () -> access.requireRetryWorker(learner(), "tenant-a"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
    }

    @Test
    void manualRecoveryRequiresPermissionAndTenant() {
        access.requireManualRecovery(operator());
        access.requireManualRecovery(operator(), "tenant-a");
        var ex = assertThrows(NotificationDomainException.class, () -> access.requireManualRecovery(learner(), "tenant-a"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
        var exTenant = assertThrows(NotificationDomainException.class, () -> access.requireManualRecovery(operator(), "tenant-b"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, exTenant.code());
    }

    @Test
    void revokedPrincipalIsForbiddenEvenWithPermission() {
        var ex = assertThrows(NotificationDomainException.class, () -> access.requireOwner(revoked(), "tenant-a", "prn-1"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
    }
}
