package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.NotificationRecoveryApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.WorkflowState;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Authorized manual recovery of notification DLQ tasks plus authorization. */
class NotificationRecoveryApplicationServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final RequestMetadata meta = new RequestMetadata("req-1", "trace-1");

    private NotificationRecoveryApplicationService recovery(InMemoryWorkflowPort workflow) {
        var notifications = new NotificationApplicationService(new InMemoryNotificationFactStore(),
                new InMemoryWorkflowPort(), new com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport(),
                new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(),
                clock, 3, Duration.ofSeconds(5), new InMemoryNotificationAuditEventStore(), new InMemoryNotificationConsentStore());
        return new NotificationRecoveryApplicationService(notifications, new InMemoryNotificationFactStore(),
                new InMemoryNotificationConsentStore(), workflow, new NotificationAccessPolicy(),
                new InMemoryOutboxEventPort(), new InMemoryNotificationAuditEventStore(), new InMemoryNotificationIdGenerator(), clock);
    }

    private String deadLetterTaskId(InMemoryWorkflowPort workflow) {
        var task = workflow.enqueue("t", "p", "NOTIFICATION_DELIVERY", "notification-message", "aid", 3, NOW);
        return workflow.moveToDlq(task.taskId(), "FATAL", NOW).taskId();
    }

    private NotificationPrincipalContext operator(String tenant) {
        return new NotificationPrincipalContext(tenant, "ops", "dev",
                Set.of("operator"), Set.of("notification.recovery"));
    }

    @Test
    void replayRequeuesDeadLetter() {
        var workflow = new InMemoryWorkflowPort();
        var svc = recovery(workflow);
        var taskId = deadLetterTaskId(workflow);
        var result = svc.recover(operator("t"), new RecoveryCommand(taskId, RecoveryAction.REPLAY, "operator-replay"), meta);
        assertEquals(WorkflowState.QUEUED, result.state());
    }

    @Test
    void cancelMovesToFailed() {
        var workflow = new InMemoryWorkflowPort();
        var svc = recovery(workflow);
        var taskId = deadLetterTaskId(workflow);
        var result = svc.recover(operator("t"), new RecoveryCommand(taskId, RecoveryAction.CANCEL, "operator-cancel"), meta);
        assertEquals(WorkflowState.FAILED, result.state());
    }

    @Test
    void manualReviewTransitionsState() {
        var workflow = new InMemoryWorkflowPort();
        var svc = recovery(workflow);
        var taskId = deadLetterTaskId(workflow);
        var result = svc.recover(operator("t"), new RecoveryCommand(taskId, RecoveryAction.MANUAL_REVIEW, "operator-review"), meta);
        assertEquals(WorkflowState.MANUAL_RECOVERY, result.state());
    }

    @Test
    void retryActionIsNotAllowedForExhaustedTask() {
        var workflow = new InMemoryWorkflowPort();
        var svc = recovery(workflow);
        var taskId = deadLetterTaskId(workflow);
        var ex = assertThrows(NotificationDomainException.class, () -> svc.recover(operator("t"),
                new RecoveryCommand(taskId, RecoveryAction.RETRY, "operator-retry"), meta));
        assertEquals(NotificationDomainException.Code.RECOVERY_NOT_ALLOWED, ex.code());
    }

    @Test
    void wrongTenantIsForbidden() {
        var workflow = new InMemoryWorkflowPort();
        var svc = recovery(workflow);
        var taskId = deadLetterTaskId(workflow);
        var ex = assertThrows(NotificationDomainException.class, () -> svc.recover(operator("t2"),
                new RecoveryCommand(taskId, RecoveryAction.REPLAY, "operator-replay"), meta));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
    }

    @Test
    void missingPermissionIsForbidden() {
        var workflow = new InMemoryWorkflowPort();
        var svc = recovery(workflow);
        var taskId = deadLetterTaskId(workflow);
        var unauthorized = new NotificationPrincipalContext("t", "p", "d", Set.of("learner"), Set.of("notification.read"));
        var ex = assertThrows(NotificationDomainException.class, () -> svc.recover(unauthorized,
                new RecoveryCommand(taskId, RecoveryAction.REPLAY, "operator-replay"), meta));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
    }
}
