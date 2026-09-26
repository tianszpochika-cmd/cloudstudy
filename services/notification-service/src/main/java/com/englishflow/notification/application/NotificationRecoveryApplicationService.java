package com.englishflow.notification.application;

import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationAuditEvent;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;
import com.englishflow.notification.domain.SafeEventAttributes;
import com.englishflow.notification.domain.WorkflowState;
import com.englishflow.notification.domain.WorkflowTask;
import com.englishflow.notification.port.NotificationAuditEventPort;
import com.englishflow.notification.port.NotificationConsentPort;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.NotificationIdGenerator;
import com.englishflow.notification.port.NotificationRecoveryPort;
import com.englishflow.notification.port.OutboxEventPort;
import com.englishflow.notification.port.WorkflowPort;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;

/** Authorized manual recovery for notification DLQ tasks plus a safe recovery notice. */
public final class NotificationRecoveryApplicationService implements NotificationRecoveryPort {

    private final NotificationApplicationService notifications;
    private final NotificationFactStore facts;
    private final NotificationConsentPort consents;
    private final WorkflowPort workflow;
    private final NotificationAccessPolicy access;
    private final OutboxEventPort events;
    private final NotificationAuditEventPort audit;
    private final NotificationIdGenerator ids;
    private final Clock clock;

    public NotificationRecoveryApplicationService(NotificationApplicationService notifications,
            NotificationFactStore facts, NotificationConsentPort consents, WorkflowPort workflow,
            NotificationAccessPolicy access, OutboxEventPort events, NotificationAuditEventPort audit,
            NotificationIdGenerator ids, Clock clock) {
        this.notifications = notifications;
        this.facts = facts;
        this.consents = consents;
        this.workflow = workflow;
        this.access = access;
        this.events = events;
        this.audit = audit;
        this.ids = ids;
        this.clock = clock;
    }

    @Override
    public RecoveryResult recover(NotificationPrincipalContext operator, RecoveryCommand command,
            RequestMetadata metadata) {
        access.requireManualRecovery(operator);
        WorkflowTask task = workflow.find(command.taskId()).orElseThrow(() ->
                new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                        "notification workflow task was not found"));
        if (!"NOTIFICATION_DELIVERY".equals(task.action()) || !"notification-message".equals(task.aggregateType())
                || task.state() != WorkflowState.DEAD_LETTER) {
            throw new NotificationDomainException(NotificationDomainException.Code.RECOVERY_NOT_ALLOWED,
                    "only notification DLQ tasks can be manually recovered");
        }
        access.requireManualRecovery(operator, task.tenantId());
        if (command.action() == RecoveryAction.RETRY) {
            throw new NotificationDomainException(NotificationDomainException.Code.RECOVERY_NOT_ALLOWED,
                    "an exhausted notification task must be replayed or cancelled");
        }
        RecoveryResult result = workflow.recover(command, clock.instant());
        events.append(new com.englishflow.notification.domain.NotificationOutboxEvent(ids.next("evt"),
                "notification.recovered.v1", "notification-message", task.aggregateId(), task.tenantId(),
                task.principalId(), metadata.traceId(), metadata.requestId(), clock.instant(),
                SafeEventAttributes.copy(Map.of("taskId", task.taskId(), "action", command.action().name(),
                        "reasonCode", command.reasonCode(), "state", result.state().name()))));
        audit.append(new NotificationAuditEvent(ids.next("audit"), "notification.manual_recovery",
                "AUTHORIZED", operator.principalId(), task.tenantId(), task.principalId(),
                "notification-message", task.aggregateId(), metadata.requestId(), metadata.traceId(),
                clock.instant(), Map.of("taskId", task.taskId(), "action", command.action().name(),
                        "reasonCode", command.reasonCode(), "state", result.state().name())));
        queueRecoveryNotice(operator, task, command, metadata);
        return result;
    }

    private void queueRecoveryNotice(NotificationPrincipalContext operator, WorkflowTask task,
            RecoveryCommand command, RequestMetadata metadata) {
        NotificationPreference preference = NotificationCategory.fromMessageType("notification.recovery.completed")
                .map(category -> facts.findPreference(task.tenantId(), task.principalId(), category,
                        NotificationChannel.IN_APP).orElse(null))
                .orElse(null);
        if (preference != null && !preference.enabled()) {
            auditFiltered(operator, task, "PREFERENCE_DISABLED", metadata);
            return;
        }
        if (!operator.consentGranted()
                || !consents.findConsent(task.tenantId(), task.principalId(), NotificationChannel.IN_APP)
                        .orElse(false)) {
            auditFiltered(operator, task, "CONSENT_NOT_GRANTED", metadata);
            return;
        }
        notifications.queueTrusted(operator, task.tenantId(), task.principalId(),
                new TemplateNotificationCommand("notification.recovery.completed", NotificationChannel.IN_APP,
                        "notification.recovery.completed", "v1",
                        preference == null ? "zh-CN" : preference.locale(),
                        Map.of("taskId", task.taskId(), "action", command.action().name()),
                        "notification-recovery-v1", clock.instant()),
                new IdempotencyKey("recovery-notification:" + task.taskId() + ':' + command.action()), metadata);
    }

    private void auditFiltered(NotificationPrincipalContext operator, WorkflowTask task, String reasonCode,
            RequestMetadata metadata) {
        audit.append(new NotificationAuditEvent(ids.next("audit"), "notification.recovery_notice", "FILTERED",
                operator.principalId(), task.tenantId(), task.principalId(), "notification-message",
                task.aggregateId(), metadata.requestId(), metadata.traceId(), clock.instant(),
                Map.of("taskId", task.taskId(), "reasonCode", reasonCode)));
    }
}
