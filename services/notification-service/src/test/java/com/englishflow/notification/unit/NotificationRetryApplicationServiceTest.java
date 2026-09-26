package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.NotificationRetryApplicationService;
import com.englishflow.notification.application.QueueNotificationCommand;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.UpdatePreferenceCommand;
import com.englishflow.notification.domain.DeliveryStatus;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.RetryDispatchStatus;
import com.englishflow.notification.domain.WorkflowState;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Retry dispatcher: due/backoff/dead-letter dispatch states and authorization. */
class NotificationRetryApplicationServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final RequestMetadata meta = new RequestMetadata("req-1", "trace-1");
    private final NotificationPrincipalContext worker = NotificationPrincipalContext.trustedService("t", "svc");

    private NotificationApplicationService notifications() {
        return new NotificationApplicationService(new InMemoryNotificationFactStore(), new InMemoryWorkflowPort(),
                new InMemoryDeliveryTransport(), new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(),
                new NotificationAccessPolicy(), clock, 3, Duration.ofSeconds(5),
                new InMemoryNotificationAuditEventStore(), consentedChannel());
    }

    private static InMemoryNotificationConsentStore consentedChannel() {
        var consents = new InMemoryNotificationConsentStore();
        consents.setConsent("t", "p", NotificationChannel.IN_APP, true);
        return consents;
    }

    private String queueMessage(NotificationApplicationService notifications, InMemoryWorkflowPort workflow) {
        var context = NotificationPrincipalContext.authenticated("t", "p", "d");
        notifications.updatePreference(context, new UpdatePreferenceCommand("LEARNING", NotificationCategory.LEARNING,
                NotificationChannel.IN_APP, true, "zh-CN", 1, NotificationDndWindow.parse("23:00", "08:00"),
                NotificationFrequencyPolicy.IMMEDIATE, 0), new IdempotencyKey("pref-retry"), meta);
        var msg = notifications.queue(context,
                new QueueNotificationCommand("LEARNING", NotificationChannel.IN_APP, "tmpl", "v1", "T", "B", "cv"),
                new IdempotencyKey("msg-" + NOW.getNano()), meta);
        return workflow.findByAggregate("notification-message", msg.messageId()).orElseThrow().taskId();
    }

    @Test
    void dueTaskDelivers() {
        var facts = new InMemoryNotificationFactStore();
        var workflow = new InMemoryWorkflowPort();
        var transport = new InMemoryDeliveryTransport();
        var notifications = new NotificationApplicationService(facts, workflow, transport,
                new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(),
                clock, 3, Duration.ofSeconds(5), new InMemoryNotificationAuditEventStore(), consentedChannel());
        var svc = new NotificationRetryApplicationService(notifications, facts, workflow,
                new NotificationAccessPolicy(), new InMemoryOutboxEventPort(), new InMemoryNotificationAuditEventStore(),
                new InMemoryNotificationIdGenerator(), clock);
        var taskId = queueMessage(notifications, workflow);
        var result = svc.dispatch(worker, taskId, meta);
        assertEquals(RetryDispatchStatus.DELIVERED, result.status());
        assertEquals(WorkflowState.SUCCEEDED, result.workflow().state());
    }

    @Test
    void retryableFailureSchedulesBackoffThenDelays() {
        var facts = new InMemoryNotificationFactStore();
        var workflow = new InMemoryWorkflowPort();
        var transport = new InMemoryDeliveryTransport();
        var notifications = new NotificationApplicationService(facts, workflow, transport,
                new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(),
                clock, 3, Duration.ofSeconds(5), new InMemoryNotificationAuditEventStore(), consentedChannel());
        var svc = new NotificationRetryApplicationService(notifications, facts, workflow,
                new NotificationAccessPolicy(), new InMemoryOutboxEventPort(), new InMemoryNotificationAuditEventStore(),
                new InMemoryNotificationIdGenerator(), clock);
        var taskId = queueMessage(notifications, workflow);
        transport.failNext("PROVIDER_TIMEOUT");
        var scheduled = svc.dispatch(worker, taskId, meta);
        assertEquals(RetryDispatchStatus.RETRY_SCHEDULED, scheduled.status());
        assertEquals(true, scheduled.delivery().attempt().retryable());
        var backoff = svc.dispatch(worker, taskId, meta);
        assertEquals(RetryDispatchStatus.DELAYED, backoff.status());
    }

    @Test
    void terminalFailureMovesToDeadLetter() {
        var facts = new InMemoryNotificationFactStore();
        var workflow = new InMemoryWorkflowPort();
        var transport = new InMemoryDeliveryTransport();
        var notifications = new NotificationApplicationService(facts, workflow, transport,
                new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(),
                clock, 3, Duration.ofSeconds(5), new InMemoryNotificationAuditEventStore(), consentedChannel());
        var svc = new NotificationRetryApplicationService(notifications, facts, workflow,
                new NotificationAccessPolicy(), new InMemoryOutboxEventPort(), new InMemoryNotificationAuditEventStore(),
                new InMemoryNotificationIdGenerator(), clock);
        var taskId = queueMessage(notifications, workflow);
        transport.failNextTerminal("INVALID_CONFIG");
        var dead = svc.dispatch(worker, taskId, meta);
        assertEquals(RetryDispatchStatus.DEAD_LETTER, dead.status());
        assertEquals(false, dead.delivery().attempt().retryable());
    }

    @Test
    void deadLetterDispatchIsNotRetried() {
        var facts = new InMemoryNotificationFactStore();
        var workflow = new InMemoryWorkflowPort();
        var transport = new InMemoryDeliveryTransport();
        var notifications = new NotificationApplicationService(facts, workflow, transport,
                new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(),
                clock, 3, Duration.ofSeconds(5), new InMemoryNotificationAuditEventStore(), consentedChannel());
        var svc = new NotificationRetryApplicationService(notifications, facts, workflow,
                new NotificationAccessPolicy(), new InMemoryOutboxEventPort(), new InMemoryNotificationAuditEventStore(),
                new InMemoryNotificationIdGenerator(), clock);
        var taskId = queueMessage(notifications, workflow);
        transport.failNextTerminal("INVALID_CONFIG");
        svc.dispatch(worker, taskId, meta);
        var again = svc.dispatch(worker, taskId, meta);
        assertEquals(RetryDispatchStatus.DEAD_LETTER, again.status());
    }

    @Test
    void dispatchRequiresRetryPermission() {
        var notifications = notifications();
        var svc = new NotificationRetryApplicationService(notifications, new InMemoryNotificationFactStore(),
                new InMemoryWorkflowPort(), new NotificationAccessPolicy(), new InMemoryOutboxEventPort(),
                new InMemoryNotificationAuditEventStore(), new InMemoryNotificationIdGenerator(), clock);
        var unauthorized = new NotificationPrincipalContext("t", "p", "d",
                java.util.Set.of("learner"), java.util.Set.of("notification.read"));
        var ex = assertThrows(NotificationDomainException.class, () -> svc.dispatch(unauthorized, "task", meta));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
    }
}
