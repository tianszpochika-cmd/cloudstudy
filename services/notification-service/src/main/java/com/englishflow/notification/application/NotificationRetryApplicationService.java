package com.englishflow.notification.application;

import com.englishflow.notification.domain.DeliveryStatus;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationAuditEvent;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationOutboxEvent;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.RetryDispatchResult;
import com.englishflow.notification.domain.RetryDispatchStatus;
import com.englishflow.notification.domain.SafeEventAttributes;
import com.englishflow.notification.domain.WorkflowState;
import com.englishflow.notification.domain.WorkflowTask;
import com.englishflow.notification.port.NotificationAuditEventPort;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.NotificationIdGenerator;
import com.englishflow.notification.port.NotificationRetryPort;
import com.englishflow.notification.port.OutboxEventPort;
import com.englishflow.notification.port.WorkflowPort;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;

/** Dispatches only due workflow tasks; it never bypasses the notification service store. */
public final class NotificationRetryApplicationService implements NotificationRetryPort {

    private final NotificationApplicationService notifications;
    private final NotificationFactStore facts;
    private final WorkflowPort workflow;
    private final NotificationAccessPolicy access;
    private final OutboxEventPort events;
    private final NotificationAuditEventPort audit;
    private final NotificationIdGenerator ids;
    private final Clock clock;

    public NotificationRetryApplicationService(NotificationApplicationService notifications,
            NotificationFactStore facts, WorkflowPort workflow, NotificationAccessPolicy access,
            OutboxEventPort events, NotificationAuditEventPort audit, NotificationIdGenerator ids, Clock clock) {
        this.notifications = notifications;
        this.facts = facts;
        this.workflow = workflow;
        this.access = access;
        this.events = events;
        this.audit = audit;
        this.ids = ids;
        this.clock = clock;
    }

    @Override
    public RetryDispatchResult dispatch(NotificationPrincipalContext worker, String taskId,
            RequestMetadata metadata) {
        access.requirePermission(worker, "notification.retry");
        WorkflowTask task = workflow.find(taskId).orElseThrow(() ->
                new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                        "notification workflow task was not found"));
        if (!"NOTIFICATION_DELIVERY".equals(task.action()) || !"notification-message".equals(task.aggregateType())) {
            throw new NotificationDomainException(NotificationDomainException.Code.RECOVERY_NOT_ALLOWED,
                    "workflow task is not owned by notification delivery");
        }
        access.requireRetryWorker(worker, task.tenantId());
        NotificationMessage message = facts.findMessage(task.tenantId(), task.principalId(), task.aggregateId())
                .orElseThrow(() -> new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                        "notification message was not found"));
        Instant now = clock.instant();
        if (task.state() == WorkflowState.DEAD_LETTER) {
            return new RetryDispatchResult(task.taskId(), RetryDispatchStatus.DEAD_LETTER, null, task,
                    "DLQ_MANUAL_RECOVERY_REQUIRED", null);
        }
        if (task.state() == WorkflowState.FAILED) {
            return new RetryDispatchResult(task.taskId(), RetryDispatchStatus.TERMINAL, null, task,
                    "TERMINAL_FAILURE", null);
        }
        Instant availableAt = task.nextRunAt().isAfter(message.notBefore()) ? task.nextRunAt() : message.notBefore();
        if (now.isBefore(availableAt)) {
            return new RetryDispatchResult(task.taskId(), RetryDispatchStatus.DELAYED, null, task,
                    "DELIVERY_NOT_DUE", availableAt);
        }

        NotificationPrincipalContext recipient = NotificationPrincipalContext.authenticated(
                task.tenantId(), task.principalId(), "notification-retry-worker");
        DeliveryResult delivery = notifications.deliver(recipient, message.messageId(),
                new IdempotencyKey("workflow-retry:" + task.taskId() + ':' + task.state().name() + ':'
                        + task.attempt()), metadata);
        WorkflowTask next = delivery.workflow();
        RetryDispatchStatus status = status(delivery.attempt().status(), next.state());
        appendEvent(status, message, worker, metadata, delivery);
        audit.append(new NotificationAuditEvent(ids.next("audit"), "notification.retry.dispatch", status.name(),
                worker.principalId(), message.tenantId(), message.principalId(), "notification-message",
                message.messageId(), metadata.requestId(), metadata.traceId(), now,
                Map.of("taskId", task.taskId(), "attemptNumber", Integer.toString(delivery.attempt().attemptNumber()),
                        "status", delivery.attempt().status().name())));
        return new RetryDispatchResult(task.taskId(), status, delivery, next,
                delivery.attempt().failureCode(), delivery.attempt().nextAttemptAt());
    }

    private void appendEvent(RetryDispatchStatus status, NotificationMessage message,
            NotificationPrincipalContext worker, RequestMetadata metadata, DeliveryResult delivery) {
        String eventName = switch (status) {
            case DELIVERED -> "notification.delivered.v1";
            case RETRY_SCHEDULED -> "notification.retry_scheduled.v1";
            case DEAD_LETTER -> "notification.dlq.v1";
            case CANCELLED -> "notification.filtered.v1";
            default -> "notification.delivery_status.v1";
        };
        events.append(new NotificationOutboxEvent(ids.next("evt"), eventName, "notification-message",
                message.messageId(), message.tenantId(), message.principalId(), metadata.traceId(),
                metadata.requestId(), clock.instant(), SafeEventAttributes.copy(Map.of(
                        "messageId", message.messageId(), "status", delivery.attempt().status().name(),
                        "attemptNumber", Integer.toString(delivery.attempt().attemptNumber()),
                        "worker", worker.principalId()))));
    }

    private static RetryDispatchStatus status(DeliveryStatus delivery, WorkflowState workflow) {
        if (delivery == DeliveryStatus.CANCELLED) return RetryDispatchStatus.CANCELLED;
        if (delivery == DeliveryStatus.DELIVERED || workflow == WorkflowState.SUCCEEDED) {
            return RetryDispatchStatus.DELIVERED;
        }
        if (workflow == WorkflowState.DEAD_LETTER) return RetryDispatchStatus.DEAD_LETTER;
        if (delivery == DeliveryStatus.RETRY_SCHEDULED || workflow == WorkflowState.RETRY_SCHEDULED) {
            return RetryDispatchStatus.RETRY_SCHEDULED;
        }
        return RetryDispatchStatus.TERMINAL;
    }
}
