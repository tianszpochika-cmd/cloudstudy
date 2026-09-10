package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.failclosed.FailClosedNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.QueueNotificationCommand;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.UpdatePreferenceCommand;
import com.englishflow.notification.domain.DeliveryStatus;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.WorkflowState;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Notification use cases: preferences, queue, delivery, idempotency, fail-closed boundary. */
class NotificationApplicationServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final NotificationPrincipalContext ctx = NotificationPrincipalContext.authenticated("t", "p", "d");
    private final RequestMetadata meta = new RequestMetadata("req-1", "trace-1");

    private NotificationApplicationService service() {
        return new NotificationApplicationService(
                new InMemoryNotificationFactStore(), new InMemoryWorkflowPort(),
                new InMemoryDeliveryTransport(), new InMemoryOutboxEventPort(),
                new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(), clock, 3, Duration.ofSeconds(30));
    }

    @Test
    void updatePreferenceIsIdempotentAndDetectsConflict() {
        var svc = service();
        var cmd = new UpdatePreferenceCommand("nt", NotificationChannel.IN_APP, true, "zh-CN", -1);
        var first = svc.updatePreference(ctx, cmd, new IdempotencyKey("pref-1"), meta);
        var replay = svc.updatePreference(ctx, cmd, new IdempotencyKey("pref-1"), meta);
        assertEquals(1, first.version());
        assertEquals(1, replay.version());

        var conflict = assertThrows(NotificationDomainException.class, () -> svc.updatePreference(ctx,
                new UpdatePreferenceCommand("nt", NotificationChannel.IN_APP, false, "zh-CN", -1),
                new IdempotencyKey("pref-1"), meta));
        assertEquals(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT, conflict.code());
    }

    @Test
    void updatePreferenceDetectsStaleVersion() {
        var svc = service();
        svc.updatePreference(ctx, new UpdatePreferenceCommand("nt", NotificationChannel.IN_APP, true, "zh-CN", -1),
                new IdempotencyKey("pref-2"), meta);
        var stale = assertThrows(NotificationDomainException.class, () -> svc.updatePreference(ctx,
                new UpdatePreferenceCommand("nt", NotificationChannel.IN_APP, true, "zh-CN", 0),
                new IdempotencyKey("pref-3"), meta));
        assertEquals(NotificationDomainException.Code.VERSION_CONFLICT, stale.code());
    }

    @Test
    void queueIsIdempotent() {
        var svc = service();
        var cmd = new QueueNotificationCommand("nt", NotificationChannel.IN_APP, "tmpl", "v1", "T", "B", "cv");
        var m1 = svc.queue(ctx, cmd, new IdempotencyKey("msg-1"), meta);
        var m2 = svc.queue(ctx, cmd, new IdempotencyKey("msg-1"), meta);
        assertEquals(m1.messageId(), m2.messageId());
    }

    @Test
    void deliverSucceedsAndCompletesWorkflow() {
        var svc = service();
        var msg = svc.queue(ctx, new QueueNotificationCommand("nt", NotificationChannel.IN_APP, "tmpl", "v1", "T", "B", "cv"),
                new IdempotencyKey("msg-2"), meta);
        var result = svc.deliver(ctx, msg.messageId(), new IdempotencyKey("del-2"), meta);
        assertEquals(DeliveryStatus.DELIVERED, result.attempt().status());
        assertEquals(WorkflowState.SUCCEEDED, result.workflow().state());
    }

    @Test
    void deliverHonorsDisabledPreferenceAsCancel() {
        var svc = service();
        svc.updatePreference(ctx, new UpdatePreferenceCommand("nt", NotificationChannel.IN_APP, false, "zh-CN", -1),
                new IdempotencyKey("pref-dis"), meta);
        var msg = svc.queue(ctx, new QueueNotificationCommand("nt", NotificationChannel.IN_APP, "tmpl", "v1", "T", "B", "cv"),
                new IdempotencyKey("msg-dis"), meta);
        var result = svc.deliver(ctx, msg.messageId(), new IdempotencyKey("del-dis"), meta);
        assertEquals(DeliveryStatus.CANCELLED, result.attempt().status());
    }

    @Test
    void deliverRejectsUnknownMessage() {
        var svc = service();
        var ex = assertThrows(NotificationDomainException.class,
                () -> svc.deliver(ctx, "missing", new IdempotencyKey("del-x"), meta));
        assertEquals(NotificationDomainException.Code.NOT_FOUND, ex.code());
    }

    @Test
    void readRequiresPermission() {
        var svc = service();
        var noPerm = new NotificationPrincipalContext("t", "p", "d", java.util.Set.of("learner"), java.util.Set.of());
        var ex = assertThrows(NotificationDomainException.class, () -> svc.preferences(noPerm));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
    }

    @Test
    void failClosedStoreRefusesAtServiceBoundary() {
        var svc = new NotificationApplicationService(
                new FailClosedNotificationFactStore(), new InMemoryWorkflowPort(), new InMemoryDeliveryTransport(),
                new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(),
                clock, 3, Duration.ofSeconds(30));
        var ex = assertThrows(NotificationDomainException.class, () -> svc.queue(ctx,
                new QueueNotificationCommand("nt", NotificationChannel.IN_APP, "tmpl", "v1", "T", "B", "cv"),
                new IdempotencyKey("msg-fc"), meta));
        assertEquals(NotificationDomainException.Code.NETWORK_UNAVAILABLE, ex.code());
    }
}
