package com.englishflow.notification;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOfflineSyncStore;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.OfflineSyncApplicationService;
import com.englishflow.notification.application.QueueNotificationCommand;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.UpdatePreferenceCommand;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import com.englishflow.notification.domain.NotificationOutboxEvent;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.OfflineChange;
import com.englishflow.notification.domain.OfflineSyncResult;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.SyncFailureState;
import com.englishflow.notification.domain.SyncStatus;
import com.englishflow.notification.domain.WorkflowState;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

/** Dependency-free B11 regression plus B12-INF-003 smoke; no infra/provider claim. */
public final class NotificationServiceSmoke {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final String DIGEST = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    private NotificationServiceSmoke() {
    }

    public static void main(String[] args) {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        InMemoryNotificationFactStore notificationStore = new InMemoryNotificationFactStore();
        InMemoryOfflineSyncStore syncStore = new InMemoryOfflineSyncStore();
        InMemoryWorkflowPort workflow = new InMemoryWorkflowPort();
        InMemoryDeliveryTransport transport = new InMemoryDeliveryTransport();
        InMemoryOutboxEventPort events = new InMemoryOutboxEventPort();
        InMemoryNotificationIdGenerator ids = new InMemoryNotificationIdGenerator();
        NotificationAccessPolicy access = new NotificationAccessPolicy();
        NotificationApplicationService notifications = new NotificationApplicationService(
                notificationStore, workflow, transport, events, ids, access, clock, 3, Duration.ofSeconds(30));
        OfflineSyncApplicationService offline = new OfflineSyncApplicationService(
                syncStore, workflow, events, ids, access, clock);
        NotificationPrincipalContext context = NotificationPrincipalContext.authenticated(
                "tenant-demo", "prn_learner00000001", "dev-b11-1");
        RequestMetadata metadata = new RequestMetadata("req-b11-smoke", "trace-b11-smoke");

        testPreferenceIdempotency(notifications, context, metadata);
        String messageId = testDeliveryRetry(notifications, context, metadata, transport, workflow);
        testDisabledDelivery(notifications, context, metadata);
        testOfflineDedupeAndConflict(offline, context, metadata);
        testOfflineFailureAndRecovery(offline, context, metadata, syncStore, workflow);
        testDefaultDeny(notifications, offline, metadata);
        testEventSafety(events.events());
        check(messageId != null && !messageId.isBlank(), "message id is available");
        System.out.println("notification-service B11-INF-002 smoke: PASS");
        NotificationB12TrustedEventSmoke.run();
    }

    private static void testPreferenceIdempotency(NotificationApplicationService service,
            NotificationPrincipalContext context, RequestMetadata metadata) {
        UpdatePreferenceCommand command = new UpdatePreferenceCommand(
                "REVIEW", NotificationCategory.REVIEW, NotificationChannel.IN_APP, true, "zh-CN", 1,
                NotificationDndWindow.parse("23:00", "08:00"), NotificationFrequencyPolicy.IMMEDIATE, 0);
        var first = service.updatePreference(context, command, new IdempotencyKey("pref-b11-1"), metadata);
        var replay = service.updatePreference(context, command, new IdempotencyKey("pref-b11-1"), metadata);
        check(first.version() == 1 && replay.version() == 1, "preference idempotency replays one fact");
        expect(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT, () -> service.updatePreference(context,
                new UpdatePreferenceCommand("REVIEW", NotificationCategory.REVIEW, NotificationChannel.IN_APP,
                        false, "zh-CN", 1, NotificationDndWindow.parse("23:00", "08:00"),
                        NotificationFrequencyPolicy.IMMEDIATE, 0), new IdempotencyKey("pref-b11-1"), metadata));
        expect(NotificationDomainException.Code.VERSION_CONFLICT, () -> service.updatePreference(context,
                new UpdatePreferenceCommand("REVIEW", NotificationCategory.REVIEW, NotificationChannel.IN_APP,
                        false, "zh-CN", 1, NotificationDndWindow.parse("23:00", "08:00"),
                        NotificationFrequencyPolicy.IMMEDIATE, 0), new IdempotencyKey("pref-b11-2"), metadata));
    }

    private static String testDeliveryRetry(NotificationApplicationService service,
            NotificationPrincipalContext context, RequestMetadata metadata,
            InMemoryDeliveryTransport transport, InMemoryWorkflowPort workflow) {
        var message = service.queue(context, new QueueNotificationCommand(
                "learning.review.due", NotificationChannel.IN_APP, "review.due", "v1",
                "Review due", "A safe reminder", "content-v1"),
                new IdempotencyKey("message-b11-1"), metadata);
        var replay = service.queue(context, new QueueNotificationCommand(
                "learning.review.due", NotificationChannel.IN_APP, "review.due", "v1",
                "Review due", "A safe reminder", "content-v1"),
                new IdempotencyKey("message-b11-1"), metadata);
        check(message.messageId().equals(replay.messageId()), "message idempotency is stable");

        transport.failNext("PROVIDER_TIMEOUT");
        var retry = service.deliver(context, message.messageId(), new IdempotencyKey("delivery-b11-1"), metadata);
        check(retry.attempt().status().name().equals("RETRY_SCHEDULED"), "provider failure schedules retry");
        var delivered = service.deliver(context, message.messageId(), new IdempotencyKey("delivery-b11-2"), metadata);
        check(delivered.attempt().status().name().equals("DELIVERED"), "retry delivers once");
        var deliveryReplay = service.deliver(context, message.messageId(), new IdempotencyKey("delivery-b11-2"), metadata);
        check(deliveryReplay.attempt().attemptId().equals(delivered.attempt().attemptId()),
                "delivery idempotency replays one attempt");
        check(workflow.findByAggregate("notification-message", message.messageId()).orElseThrow().state()
                == WorkflowState.SUCCEEDED, "delivery workflow completes");
        return message.messageId();
    }

    private static void testDisabledDelivery(NotificationApplicationService service,
            NotificationPrincipalContext context, RequestMetadata metadata) {
        service.updatePreference(context, new UpdatePreferenceCommand(
                "LEARNING", NotificationCategory.LEARNING, NotificationChannel.PUSH, false, "zh-CN", 1,
                NotificationDndWindow.parse("23:00", "08:00"), NotificationFrequencyPolicy.IMMEDIATE, 0),
                new IdempotencyKey("pref-b11-disabled"), metadata);
        var message = service.queue(context, new QueueNotificationCommand(
                "LEARNING", NotificationChannel.PUSH, "disabled", "v1",
                "Disabled", "Safe body", "content-v1"),
                new IdempotencyKey("message-b11-disabled"), metadata);
        var delivery = service.deliver(context, message.messageId(),
                new IdempotencyKey("delivery-b11-disabled"), metadata);
        check(delivery.attempt().status().name().equals("CANCELLED"), "disabled channel is not sent");
    }

    private static void testOfflineDedupeAndConflict(OfflineSyncApplicationService service,
            NotificationPrincipalContext context, RequestMetadata metadata) {
        OfflineChange first = change(context, "event-b11-1", 1, 0,
                new com.englishflow.notification.domain.OfflineVector(Map.of(context.deviceId(), 1L)));
        OfflineSyncResult accepted = service.sync(context, first, metadata);
        check(accepted.status() == SyncStatus.APPLIED && accepted.cursor().serverVersion() == 1,
                "first offline change advances cursor");
        OfflineSyncResult replay = service.sync(context, first, metadata);
        check(replay.status() == SyncStatus.REPLAYED && replay.replayed(), "clientEventId dedupe replays");

        expect(NotificationDomainException.Code.SEQUENCE_CONFLICT, () -> service.sync(context,
                change(context, "event-b11-seq-reuse", 1, 1,
                        new com.englishflow.notification.domain.OfflineVector(Map.of(context.deviceId(), 1L))), metadata));
        OfflineSyncResult gap = service.sync(context,
                change(context, "event-b11-gap", 3, 1,
                        new com.englishflow.notification.domain.OfflineVector(Map.of(context.deviceId(), 3L))), metadata);
        check(gap.status() == SyncStatus.CONFLICT && "CLIENT_SEQUENCE_GAP".equals(gap.conflict().reason()),
                "client sequence gap is explicit");
        OfflineSyncResult vectorConflict = service.sync(context,
                change(context, "event-b11-vector", 2, 1,
                        new com.englishflow.notification.domain.OfflineVector(Map.of("other-device", 1L))), metadata);
        check(vectorConflict.status() == SyncStatus.CONFLICT
                && "VECTOR_CONCURRENT".equals(vectorConflict.conflict().reason()),
                "concurrent vector is not silently overwritten");
    }

    private static void testOfflineFailureAndRecovery(OfflineSyncApplicationService service,
            NotificationPrincipalContext context, RequestMetadata metadata,
            InMemoryOfflineSyncStore store, InMemoryWorkflowPort workflow) {
        store.failWith(SyncFailureState.STORAGE_FULL);
        OfflineSyncResult full = service.sync(context,
                change(context, "event-b11-full", 2, 1,
                        new com.englishflow.notification.domain.OfflineVector(Map.of(context.deviceId(), 2L))), metadata);
        check(full.status() == SyncStatus.FAILED && full.failureState() == SyncFailureState.STORAGE_FULL,
                "storage-full is recoverable state");
        store.failWith(SyncFailureState.NETWORK_UNAVAILABLE);
        OfflineSyncResult network = service.sync(context,
                change(context, "event-b11-network", 2, 1,
                        new com.englishflow.notification.domain.OfflineVector(Map.of(context.deviceId(), 2L))), metadata);
        check(network.status() == SyncStatus.FAILED && network.failureState() == SyncFailureState.NETWORK_UNAVAILABLE,
                "network failure is distinct");
        store.failWith(SyncFailureState.PERMISSION_DENIED);
        OfflineSyncResult permission = service.sync(context,
                change(context, "event-b11-permission", 2, 1,
                        new com.englishflow.notification.domain.OfflineVector(Map.of(context.deviceId(), 2L))), metadata);
        check(permission.status() == SyncStatus.FAILED
                && permission.failureState() == SyncFailureState.PERMISSION_DENIED,
                "permission failure is distinct");
        store.recoverStorage();
        OfflineChange accepted = change(context, "event-b11-recovery", 2, 1,
                new com.englishflow.notification.domain.OfflineVector(Map.of(context.deviceId(), 2L)));
        service.sync(context, accepted, metadata);
        String taskId = workflow.findByAggregate("offline-change", accepted.clientEventId()).orElseThrow().taskId();
        var recovery = service.recover(context,
                new RecoveryCommand(taskId, RecoveryAction.MANUAL_REVIEW, "operator-reviewed"), metadata);
        check(recovery.state() == WorkflowState.MANUAL_RECOVERY, "manual recovery transitions workflow");
    }

    private static void testDefaultDeny(NotificationApplicationService notifications,
            OfflineSyncApplicationService offline, RequestMetadata metadata) {
        NotificationPrincipalContext noPermission = new NotificationPrincipalContext(
                "tenant-demo", "prn-unauthorized", "dev-unauthorized", Set.of(), Set.of());
        expect(NotificationDomainException.Code.FORBIDDEN, () -> notifications.preferences(noPermission));
        expect(NotificationDomainException.Code.FORBIDDEN, () -> offline.cursor(noPermission));
    }

    private static void testEventSafety(java.util.List<NotificationOutboxEvent> events) {
        check(!events.isEmpty(), "safe outbox facts are emitted");
        for (NotificationOutboxEvent event : events) {
            for (String key : event.attributes().keySet()) {
                check(!key.toLowerCase().contains("payload") && !key.toLowerCase().contains("audio"),
                        "outbox contains no raw payload/media");
            }
        }
    }

    private static OfflineChange change(NotificationPrincipalContext context, String eventId, long seq,
            long baseVersion, com.englishflow.notification.domain.OfflineVector vector) {
        return new OfflineChange(context.tenantId(), context.principalId(), context.deviceId(), eventId,
                seq, "LISTENING_PROGRESS", "lesson-1", "UPSERT", baseVersion, vector, DIGEST, NOW);
    }

    private static void expect(NotificationDomainException.Code code, Runnable action) {
        try {
            action.run();
        } catch (NotificationDomainException exception) {
            if (exception.code() == code) {
                return;
            }
            throw exception;
        }
        throw new AssertionError("expected " + code);
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }
}
