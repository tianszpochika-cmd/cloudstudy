package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOfflineSyncStore;
import com.englishflow.notification.adapter.memory.InMemoryTrustedEventReceiptStore;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.domain.DeliveryAttempt;
import com.englishflow.notification.domain.DeliveryStatus;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.OfflineChange;
import com.englishflow.notification.domain.OfflineSyncReceipt;
import com.englishflow.notification.domain.OfflineVector;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.SyncCursor;
import com.englishflow.notification.domain.SyncFailureState;
import com.englishflow.notification.domain.SyncStatus;
import com.englishflow.notification.domain.TrustedEventReceipt;
import com.englishflow.notification.domain.TrustedEventReceiptStatus;
import com.englishflow.notification.domain.WorkflowState;
import com.englishflow.notification.domain.WorkflowTask;
import com.englishflow.notification.port.DeliveryTransport;
import com.englishflow.notification.port.OfflineSyncStoreException;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Behaviour of the in-memory ports used by unit and local runs. */
class InMemoryAdaptersTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final String DIGEST = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    // --- InMemoryWorkflowPort ---

    @Test
    void workflowStateMachineTransitions() {
        var workflow = new InMemoryWorkflowPort();
        var task = workflow.enqueue("t", "p", "A", "at", "aid", 3, NOW);
        assertEquals(WorkflowState.QUEUED, task.state());

        var retried = workflow.scheduleRetry(task.taskId(), "TIMEOUT", NOW.plusSeconds(10));
        assertEquals(WorkflowState.RETRY_SCHEDULED, retried.state());
        assertEquals(1, retried.attempt());

        var done = workflow.complete(retried.taskId(), NOW);
        assertEquals(WorkflowState.SUCCEEDED, done.state());

        var dlq = workflow.moveToDlq(task.taskId(), "FATAL", NOW);
        assertEquals(WorkflowState.DEAD_LETTER, dlq.state());
    }

    @Test
    void workflowRetryBudgetExhaustsToDlq() {
        var workflow = new InMemoryWorkflowPort();
        var task = workflow.enqueue("t", "p", "A", "at", "aid", 2, NOW);
        workflow.scheduleRetry(task.taskId(), "TIMEOUT", NOW); // attempt 1
        workflow.scheduleRetry(task.taskId(), "TIMEOUT", NOW); // attempt 2
        var exhausted = workflow.scheduleRetry(task.taskId(), "TIMEOUT", NOW); // attempt 3 > max
        assertEquals(WorkflowState.DEAD_LETTER, exhausted.state());
    }

    @Test
    void workflowRecoverRejectsExhaustedRetryAndUnknownTask() {
        var workflow = new InMemoryWorkflowPort();
        var task = workflow.enqueue("t", "p", "A", "at", "aid", 2, NOW);
        workflow.scheduleRetry(task.taskId(), "TIMEOUT", NOW);
        workflow.scheduleRetry(task.taskId(), "TIMEOUT", NOW);
        workflow.scheduleRetry(task.taskId(), "TIMEOUT", NOW); // -> DEAD_LETTER
        var ex = assertThrows(NotificationDomainException.class, () -> workflow.recover(
                new RecoveryCommand(task.taskId(), RecoveryAction.RETRY, "r"), NOW));
        assertEquals(NotificationDomainException.Code.RECOVERY_NOT_ALLOWED, ex.code());
        assertTrue(workflow.find("missing").isEmpty());
    }

    // --- InMemoryTrustedEventReceiptStore ---

    @Test
    void receiptStoreDeduplicatesByEventAndDedupeKey() {
        var store = new InMemoryTrustedEventReceiptStore();
        var receipt = new TrustedEventReceipt("consumer", "evt-1", "name", "dk-1", "fp-1",
                TrustedEventReceiptStatus.RECEIVED, 0, null, null, null, NOW, NOW);
        var first = store.claim(receipt);
        assertTrue(first.created());

        var sameEvent = store.claim(receipt);
        assertFalse(sameEvent.created());

        var differentFp = new TrustedEventReceipt("consumer", "evt-1", "name", "dk-1", "fp-2",
                TrustedEventReceiptStatus.RECEIVED, 0, null, null, null, NOW, NOW);
        assertThrows(NotificationDomainException.class, () -> store.claim(differentFp));

        var sameDedupe = new TrustedEventReceipt("consumer", "evt-2", "name", "dk-1", "fp-1",
                TrustedEventReceiptStatus.RECEIVED, 0, null, null, null, NOW, NOW);
        assertFalse(store.claim(sameDedupe).created());
    }

    // --- InMemoryNotificationFactStore ---

    @Test
    void factStorePersistsPreferencesAndMessages() {
        var store = new InMemoryNotificationFactStore();
        var pref = new NotificationPreference("t", "p",
                com.englishflow.notification.domain.NotificationCategory.SYSTEM, NotificationChannel.IN_APP,
                true, "zh-CN", 1,
                com.englishflow.notification.domain.NotificationDndWindow.parse("23:00", "08:00"),
                com.englishflow.notification.domain.NotificationFrequencyPolicy.IMMEDIATE, 1, NOW);
        assertTrue(store.compareAndSetPreference(pref, 0));
        assertEquals(pref, store.findPreference("t", "p",
                com.englishflow.notification.domain.NotificationCategory.SYSTEM, NotificationChannel.IN_APP).orElseThrow());
        assertEquals(1, store.findPreferences("t", "p").size());

        var m1 = message("m1", NOW);
        var m2 = message("m2", NOW.plusSeconds(5));
        store.saveMessage(m1);
        store.saveMessage(m2);
        var found = store.findMessages("t", "p", 10);
        assertEquals(2, found.size());
        assertEquals("m2", found.get(0).messageId()); // newest first
        assertEquals(1, store.findMessages("t", "p", 1).size());
    }

    @Test
    void factStoreIdempotencyRoundTrip() {
        var store = new InMemoryNotificationFactStore();
        var value = new com.englishflow.notification.port.StoredIdempotency("fp", "result");
        store.saveIdempotency("scope", "key", value);
        assertEquals("result", store.findIdempotency("scope", "key").orElseThrow().value());

        var attempt = new DeliveryAttempt("a1", "m1", NotificationChannel.IN_APP, 1,
                DeliveryStatus.DELIVERED, null, null, "req", "trace", NOW);
        store.appendDeliveryAttempt(attempt);
        assertEquals(1, store.findDeliveryAttempts("m1").size());
    }

    // --- InMemoryNotificationConsentStore ---

    @Test
    void consentStoreReturnsUnknownAsEmpty() {
        var store = new InMemoryNotificationConsentStore();
        assertTrue(store.findConsent("t", "p", NotificationChannel.IN_APP).isEmpty());
        store.setConsent("t", "p", NotificationChannel.IN_APP, false);
        assertEquals(false, store.findConsent("t", "p", NotificationChannel.IN_APP).orElseThrow());
    }

    // --- InMemoryOfflineSyncStore ---

    @Test
    void offlineSyncStoreAcceptsAndDetectsDuplicate() {
        var store = new InMemoryOfflineSyncStore();
        var ctx = NotificationPrincipalContext.authenticated("t", "p", "d");
        var cursor = store.cursor(ctx);
        var change = change(ctx, "e1", 1);
        var receipt = new OfflineSyncReceipt("e1", "fp", 1, SyncStatus.APPLIED, 1, NOW);
        var next = cursor.advance(change, NOW);
        store.accept(ctx, change, cursor, receipt, next);
        assertEquals(receipt, store.findByClientEventId(ctx, "e1").orElseThrow());
        // duplicate append is rejected by the store
        assertThrows(IllegalStateException.class, () -> store.accept(ctx, change, next, receipt, next));
    }

    @Test
    void offlineSyncStoreSurfacesFailureState() {
        var store = new InMemoryOfflineSyncStore();
        var ctx = NotificationPrincipalContext.authenticated("t", "p", "d");
        store.failWith(SyncFailureState.STORAGE_FULL);
        var cursor = store.cursor(ctx);
        var change = change(ctx, "e1", 1);
        var receipt = new OfflineSyncReceipt("e1", "fp", 1, SyncStatus.APPLIED, 1, NOW);
        assertThrows(OfflineSyncStoreException.class,
                () -> store.accept(ctx, change, cursor, receipt, cursor.advance(change, NOW)));
    }

    // --- InMemoryDeliveryTransport ---

    @Test
    void deliveryTransportFailsThenSucceeds() {
        var transport = new InMemoryDeliveryTransport();
        transport.failNext("TIMEOUT");
        DeliveryTransport.DeliveryOutcome failed = transport.deliver(message("m", NOW), NotificationChannel.IN_APP);
        assertFalse(failed.delivered());
        DeliveryTransport.DeliveryOutcome ok = transport.deliver(message("m", NOW), NotificationChannel.IN_APP);
        assertTrue(ok.delivered());
    }

    // --- InMemoryNotificationIdGenerator ---

    @Test
    void idGeneratorIsUnique() {
        var ids = new InMemoryNotificationIdGenerator();
        assertNotEquals(ids.next("msg"), ids.next("msg"));
        assertTrue(ids.next("msg").startsWith("msg-"));
    }

    // --- helpers ---

    private static OfflineChange change(NotificationPrincipalContext ctx, String eventId, long seq) {
        return new OfflineChange(ctx.tenantId(), ctx.principalId(), ctx.deviceId(), eventId, seq,
                "ET", "eid", "UPSERT", 0, new OfflineVector(java.util.Map.of(ctx.deviceId(), seq)), DIGEST, NOW);
    }

    private static NotificationMessage message(String id, Instant createdAt) {
        return new NotificationMessage(id, "t", "p", "nt", NotificationChannel.IN_APP,
                "tmpl", "v1", "Title", "Safe body", "cv1", 1, createdAt);
    }
}
