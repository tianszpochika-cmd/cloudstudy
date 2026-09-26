package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.failclosed.FailClosedNotificationAuditEventStore;
import com.englishflow.notification.adapter.failclosed.FailClosedNotificationConsentStore;
import com.englishflow.notification.adapter.failclosed.FailClosedNotificationFactStore;
import com.englishflow.notification.adapter.failclosed.FailClosedOfflineSyncStore;
import com.englishflow.notification.adapter.failclosed.FailClosedOutboxEventPort;
import com.englishflow.notification.adapter.failclosed.FailClosedTrustedEventReceiptStore;
import com.englishflow.notification.adapter.failclosed.FailClosedWorkflowPort;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.SyncCursor;
import com.englishflow.notification.domain.SyncFailureState;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Fail-closed boundary adapters must refuse (throw) rather than silently
 * accept or implicitly grant when the durable owner is not configured.
 */
class FailClosedAdaptersTest {

    private static final NotificationDomainException.Code CODE = NotificationDomainException.Code.NETWORK_UNAVAILABLE;

    @Test
    void auditEventStoreRefuses() {
        var store = new FailClosedNotificationAuditEventStore();
        assertCode(CODE, () -> store.append(null));
        assertCode(CODE, store::events);
    }

    @Test
    void consentStoreRefusesRatherThanImplicitGrant() {
        var store = new FailClosedNotificationConsentStore();
        assertCode(CODE, () -> store.findConsent("t", "p", NotificationChannel.IN_APP));
    }

    @Test
    void factStoreRefusesEveryMethod() {
        var store = new FailClosedNotificationFactStore();
        assertCode(CODE, () -> store.findPreference("t", "p", NotificationCategory.LEARNING,
                NotificationChannel.IN_APP));
        assertCode(CODE, () -> store.findPreferences("t", "p"));
        assertCode(CODE, () -> store.compareAndSetPreference(null, 0));
        assertCode(CODE, () -> store.saveMessage(null));
        assertCode(CODE, () -> store.findMessage("t", "p", "m"));
        assertCode(CODE, () -> store.findMessages("t", "p", 10));
        assertCode(CODE, () -> store.appendDeliveryAttempt(null));
        assertCode(CODE, () -> store.findDeliveryAttempts("m"));
        assertCode(CODE, () -> store.findIdempotency("s", "k"));
        assertCode(CODE, () -> store.saveIdempotency("s", "k", null));
    }

    @Test
    void offlineSyncStoreRefuses() {
        var store = new FailClosedOfflineSyncStore();
        assertCode(CODE, () -> store.findByClientEventId(null, "e"));
        assertCode(CODE, () -> store.findByClientSequence(null, 1L));
        assertCode(CODE, () -> store.cursor(null));
        assertCode(CODE, () -> store.accept(null, null, SyncCursor.initial("t", "p", "d", Instant.EPOCH), null, null));
        assertCode(CODE, store::failureState);
    }

    @Test
    void outboxEventPortRefuses() {
        var port = new FailClosedOutboxEventPort();
        assertCode(CODE, () -> port.append(null));
        assertCode(CODE, port::events);
    }

    @Test
    void trustedEventReceiptStoreRefuses() {
        var store = new FailClosedTrustedEventReceiptStore();
        assertCode(CODE, () -> store.claim(null));
        assertCode(CODE, () -> store.save(null));
    }

    @Test
    void workflowPortRefuses() {
        var port = new FailClosedWorkflowPort();
        Instant now = Instant.EPOCH;
        assertCode(CODE, () -> port.enqueue("t", "p", "a", "at", "aid", 3, now));
        assertCode(CODE, () -> port.scheduleRetry("id", "reason", now));
        assertCode(CODE, () -> port.complete("id", now));
        assertCode(CODE, () -> port.moveToDlq("id", "reason", now));
        assertCode(CODE, () -> port.find("id"));
        assertCode(CODE, () -> port.findByAggregate("at", "aid"));
        assertCode(CODE, () -> port.recover(new RecoveryCommand("id", RecoveryAction.REPLAY, "r"), now));
    }

    @Test
    void failureStateRemainsDistinctFromGranted() {
        // The fail-closed store never returns a "storage is fine" signal.
        var store = new FailClosedOfflineSyncStore();
        var ex = assertThrows(NotificationDomainException.class, store::failureState);
        assertEquals(CODE, ex.code());
    }

    private static void assertCode(NotificationDomainException.Code expected, ThrowingRunnable runnable) {
        NotificationDomainException ex = assertThrows(NotificationDomainException.class, runnable::run);
        assertEquals(expected, ex.code(), "fail-closed adapter must refuse with NETWORK_UNAVAILABLE");
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Throwable;
    }
}
