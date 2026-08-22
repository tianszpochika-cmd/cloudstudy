package com.englishflow.notification.application;

import com.englishflow.notification.domain.DeliveryAttempt;
import com.englishflow.notification.domain.DeliveryStatus;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationOutboxEvent;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.SafeEventAttributes;
import com.englishflow.notification.domain.WorkflowState;
import com.englishflow.notification.domain.WorkflowTask;
import com.englishflow.notification.port.DeliveryTransport;
import com.englishflow.notification.port.NotificationAuditEventPort;
import com.englishflow.notification.port.NotificationConsentPort;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.NotificationIdGenerator;
import com.englishflow.notification.port.OutboxEventPort;
import com.englishflow.notification.port.StoredIdempotency;
import com.englishflow.notification.port.WorkflowPort;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** Use cases for preferences, in-app messages, delivery and idempotent retry. */
public final class NotificationApplicationService {

    private static final String MESSAGE_AGGREGATE = "notification-message";
    private final NotificationFactStore store;
    private final WorkflowPort workflow;
    private final DeliveryTransport transport;
    private final OutboxEventPort events;
    private final NotificationIdGenerator ids;
    private final NotificationAccessPolicy access;
    private final Clock clock;
    private final int maxDeliveryAttempts;
    private final Duration retryBackoff;
    private final NotificationAuditEventPort audit;
    private final NotificationConsentPort consents;

    public NotificationApplicationService(NotificationFactStore store, WorkflowPort workflow,
            DeliveryTransport transport, OutboxEventPort events, NotificationIdGenerator ids,
            NotificationAccessPolicy access, Clock clock, int maxDeliveryAttempts, Duration retryBackoff) {
        this(store, workflow, transport, events, ids, access, clock, maxDeliveryAttempts, retryBackoff,
                noopAudit(), noopConsent());
    }

    public NotificationApplicationService(NotificationFactStore store, WorkflowPort workflow,
            DeliveryTransport transport, OutboxEventPort events, NotificationIdGenerator ids,
            NotificationAccessPolicy access, Clock clock, int maxDeliveryAttempts, Duration retryBackoff,
            NotificationAuditEventPort audit) {
        this(store, workflow, transport, events, ids, access, clock, maxDeliveryAttempts, retryBackoff,
                audit, noopConsent());
    }

    public NotificationApplicationService(NotificationFactStore store, WorkflowPort workflow,
            DeliveryTransport transport, OutboxEventPort events, NotificationIdGenerator ids,
            NotificationAccessPolicy access, Clock clock, int maxDeliveryAttempts, Duration retryBackoff,
            NotificationAuditEventPort audit, NotificationConsentPort consents) {
        if (maxDeliveryAttempts < 1 || retryBackoff.isNegative() || retryBackoff.isZero()) {
            throw new IllegalArgumentException("delivery policy is invalid");
        }
        this.store = store;
        this.workflow = workflow;
        this.transport = transport;
        this.events = events;
        this.ids = ids;
        this.access = access;
        this.clock = clock;
        this.maxDeliveryAttempts = maxDeliveryAttempts;
        this.retryBackoff = retryBackoff;
        this.audit = java.util.Objects.requireNonNull(audit, "audit");
        this.consents = java.util.Objects.requireNonNull(consents, "consents");
    }

    public List<NotificationPreference> preferences(NotificationPrincipalContext context) {
        access.requirePermission(context, "notification.read");
        return store.findPreferences(context.tenantId(), context.principalId());
    }

    public NotificationPreference updatePreference(NotificationPrincipalContext context,
            UpdatePreferenceCommand command, IdempotencyKey key, RequestMetadata metadata) {
        access.requirePermission(context, "notification.write");
        String scope = "preference:" + context.tenantId() + ':' + context.principalId();
        String fingerprint = command.fingerprint();
        var existingCommand = store.findIdempotency(scope, key.value());
        if (existingCommand.isPresent()) {
            ensureSameFingerprint(existingCommand.get(), fingerprint);
            return cast(existingCommand.get().value(), NotificationPreference.class);
        }

        var current = store.findPreference(context.tenantId(), context.principalId(),
                command.notificationType(), command.channel());
        if (current.isPresent() && command.expectedVersion() >= 0
                && current.get().version() != command.expectedVersion()) {
            throw new NotificationDomainException(NotificationDomainException.Code.VERSION_CONFLICT,
                    "notification preference version is stale");
        }
        if (current.isEmpty() && command.expectedVersion() > 0) {
            throw new NotificationDomainException(NotificationDomainException.Code.VERSION_CONFLICT,
                    "notification preference does not exist at the requested version");
        }
        Instant now = clock.instant();
        NotificationPreference next = current.map(value -> value.change(command.enabled(), command.locale(), now))
                .orElseGet(() -> new NotificationPreference(context.tenantId(), context.principalId(),
                        command.notificationType(), command.channel(), command.enabled(), command.locale(), 1, now));
        store.savePreference(next);
        store.saveIdempotency(scope, key.value(), new StoredIdempotency(fingerprint, next));
        appendAudit("notification.preference.updated", "APPLIED", context.principalId(), next.tenantId(),
                next.principalId(), "notification-preference",
                next.notificationType() + ':' + next.channel().name(), metadata,
                java.util.Map.of("notificationType", next.notificationType(), "channel", next.channel().name(),
                        "enabled", Boolean.toString(next.enabled()), "version", Long.toString(next.version())));
        return next;
    }

    public NotificationMessage queue(NotificationPrincipalContext context, QueueNotificationCommand command,
            IdempotencyKey key, RequestMetadata metadata) {
        access.requirePermission(context, "notification.write");
        String scope = "message:" + context.tenantId() + ':' + context.principalId();
        String fingerprint = command.fingerprint();
        var existingCommand = store.findIdempotency(scope, key.value());
        if (existingCommand.isPresent()) {
            ensureSameFingerprint(existingCommand.get(), fingerprint);
            return cast(existingCommand.get().value(), NotificationMessage.class);
        }
        Instant now = clock.instant();
        NotificationMessage message = new NotificationMessage(ids.next("msg"), context.tenantId(),
                context.principalId(), command.notificationType(), command.channel(), command.templateKey(),
                command.templateVersion(), command.title(), command.safeBody(), command.contentVersion(), 1, now);
        store.saveMessage(message);
        workflow.enqueue(context.tenantId(), context.principalId(), "NOTIFICATION_DELIVERY",
                MESSAGE_AGGREGATE, message.messageId(),
                maxDeliveryAttempts, now);
        store.saveIdempotency(scope, key.value(), new StoredIdempotency(fingerprint, message));
        appendEvent("notification.queued.v1", message.messageId(), context, metadata,
                java.util.Map.of("messageId", message.messageId(), "channel", message.channel().name(),
                        "templateKey", message.templateKey()));
        appendAudit("notification.queued", "APPLIED", context.principalId(), message.tenantId(), message.principalId(),
                MESSAGE_AGGREGATE, message.messageId(), metadata,
                java.util.Map.of("channel", message.channel().name(), "templateId", message.templateId()));
        return message;
    }

    /**
     * Internal template-only queueing path for trusted event consumers and
     * authorized recovery workers. It never accepts title/body text.
     */
    public NotificationMessage queueTrusted(NotificationPrincipalContext caller, String tenantId,
            String principalId, TemplateNotificationCommand command, IdempotencyKey key,
            RequestMetadata metadata) {
        access.requireTrustedNotificationWriter(caller, tenantId);
        if (tenantId == null || principalId == null || tenantId.isBlank() || principalId.isBlank()) {
            throw NotificationDomainException.invalid("trusted notification recipient is invalid");
        }
        String scope = "trusted-message:" + tenantId + ':' + principalId;
        String fingerprint = command.fingerprint();
        var existingCommand = store.findIdempotency(scope, key.value());
        if (existingCommand.isPresent()) {
            ensureSameFingerprint(existingCommand.get(), fingerprint);
            return cast(existingCommand.get().value(), NotificationMessage.class);
        }
        Instant now = clock.instant();
        NotificationMessage message = NotificationMessage.trustedTemplate(ids.next("msg"), tenantId, principalId,
                command.notificationType(), command.channel(), command.templateId(), command.templateVersion(),
                command.locale(), command.structuredAttributes(), command.contentVersion(), 1, now,
                command.notBefore());
        store.saveMessage(message);
        workflow.enqueue(tenantId, principalId, "NOTIFICATION_DELIVERY", MESSAGE_AGGREGATE,
                message.messageId(), maxDeliveryAttempts, now);
        store.saveIdempotency(scope, key.value(), new StoredIdempotency(fingerprint, message));
        appendEvent("notification.queued.v1", message.messageId(),
                NotificationPrincipalContext.authenticated(tenantId, principalId, "trusted-event-worker"), metadata,
                java.util.Map.of("messageId", message.messageId(), "channel", message.channel().name(),
                        "templateId", message.templateId(), "locale", message.locale()));
        appendAudit("notification.queued", "APPLIED", caller.principalId(), tenantId, principalId,
                MESSAGE_AGGREGATE, message.messageId(), metadata,
                java.util.Map.of("channel", message.channel().name(), "templateId", message.templateId(),
                        "locale", message.locale()));
        return message;
    }

    public List<NotificationMessage> messages(NotificationPrincipalContext context, int limit) {
        access.requirePermission(context, "notification.read");
        return store.findMessages(context.tenantId(), context.principalId(), limit);
    }

    public DeliveryResult deliver(NotificationPrincipalContext context, String messageId,
            IdempotencyKey key, RequestMetadata metadata) {
        access.requirePermission(context, "notification.write");
        NotificationMessage message = store.findMessage(context.tenantId(), context.principalId(), messageId)
                .orElseThrow(() -> new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                        "notification message was not found"));
        String scope = "delivery:" + context.tenantId() + ':' + context.principalId() + ':' + messageId;
        String fingerprint = messageId + '|' + message.channel();
        var existingCommand = store.findIdempotency(scope, key.value());
        if (existingCommand.isPresent()) {
            ensureSameFingerprint(existingCommand.get(), fingerprint);
            return cast(existingCommand.get().value(), DeliveryResult.class);
        }

        Instant now = clock.instant();
        List<DeliveryAttempt> previous = store.findDeliveryAttempts(messageId);
        DeliveryAttempt terminal = previous.stream()
                .filter(attempt -> attempt.status() == DeliveryStatus.DELIVERED
                        || attempt.status() == DeliveryStatus.CANCELLED)
                .findFirst()
                .orElse(null);
        WorkflowTask existingWorkflow = workflow.findByAggregate(MESSAGE_AGGREGATE, message.messageId())
                .orElseThrow(() -> new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                        "notification workflow task was not found"));
        if (terminal != null) {
            DeliveryResult result = new DeliveryResult(terminal, existingWorkflow, true);
            store.saveIdempotency(scope, key.value(), new StoredIdempotency(fingerprint, result));
            return result;
        }
        if (existingWorkflow.state() == WorkflowState.DEAD_LETTER
                || existingWorkflow.state() == WorkflowState.MANUAL_RECOVERY
                || existingWorkflow.state() == WorkflowState.FAILED) {
            throw new NotificationDomainException(NotificationDomainException.Code.RETRY_EXHAUSTED,
                    "delivery requires workflow recovery before another attempt");
        }
        int attemptNumber = previous.size() + 1;
        boolean preferenceEnabled = store.findPreference(context.tenantId(), context.principalId(),
                message.notificationType(), message.channel()).map(NotificationPreference::enabled).orElse(true);
        boolean consentGranted = !message.templateOnly()
                || consents.findConsent(context.tenantId(), context.principalId(), message.channel()).orElse(false);
        boolean enabled = preferenceEnabled && consentGranted;
        String filterCode = !preferenceEnabled ? "PREFERENCE_DISABLED" : "CONSENT_NOT_GRANTED";
        WorkflowTask task = existingWorkflow;

        DeliveryTransport.DeliveryOutcome outcome;
        if (!enabled) {
            outcome = DeliveryTransport.DeliveryOutcome.failed(filterCode);
        } else {
            outcome = transport.deliver(message, message.channel());
        }
        DeliveryStatus status;
        Instant nextAttemptAt = null;
        WorkflowTask nextWorkflow;
        if (outcome.delivered()) {
            status = DeliveryStatus.DELIVERED;
            nextWorkflow = workflow.complete(task.taskId(), now);
            appendEvent("notification.delivered.v1", message.messageId(), context, metadata,
                    java.util.Map.of("messageId", message.messageId(), "channel", message.channel().name(),
                            "attemptNumber", Integer.toString(attemptNumber)));
            appendAudit("notification.delivered", "APPLIED", context.principalId(), message.tenantId(),
                    message.principalId(), MESSAGE_AGGREGATE, message.messageId(), metadata,
                    java.util.Map.of("channel", message.channel().name(),
                            "attemptNumber", Integer.toString(attemptNumber)));
        } else if (!enabled) {
            status = DeliveryStatus.CANCELLED;
            nextWorkflow = workflow.complete(task.taskId(), now);
            appendEvent("notification.filtered.v1", message.messageId(), context, metadata,
                    java.util.Map.of("messageId", message.messageId(), "reasonCode", filterCode));
            appendAudit("notification.filtered", "REJECTED", context.principalId(), message.tenantId(),
                    message.principalId(), MESSAGE_AGGREGATE, message.messageId(), metadata,
                    java.util.Map.of("reasonCode", filterCode, "channel", message.channel().name()));
        } else if (outcome.disposition() == DeliveryTransport.FailureDisposition.TERMINAL) {
            status = DeliveryStatus.FAILED;
            nextWorkflow = workflow.moveToDlq(task.taskId(), outcome.failureCode(), now);
            appendAudit("notification.delivery_failed", "TERMINAL", context.principalId(), message.tenantId(),
                    message.principalId(), MESSAGE_AGGREGATE, message.messageId(), metadata,
                    java.util.Map.of("failureCode", outcome.failureCode(), "retryable", "false"));
        } else if (attemptNumber >= maxDeliveryAttempts) {
            status = DeliveryStatus.FAILED;
            nextWorkflow = workflow.moveToDlq(task.taskId(), outcome.failureCode(), now);
            appendEvent("notification.dlq.v1", message.messageId(), context, metadata,
                    java.util.Map.of("messageId", message.messageId(), "failureCode", outcome.failureCode(),
                            "attemptNumber", Integer.toString(attemptNumber)));
            appendAudit("notification.dlq", "DEAD_LETTER", context.principalId(), message.tenantId(),
                    message.principalId(), MESSAGE_AGGREGATE, message.messageId(), metadata,
                    java.util.Map.of("failureCode", outcome.failureCode(),
                            "attemptNumber", Integer.toString(attemptNumber), "retryable", "true"));
        } else {
            status = DeliveryStatus.RETRY_SCHEDULED;
            nextAttemptAt = now.plus(retryBackoff.multipliedBy(attemptNumber));
            nextWorkflow = workflow.scheduleRetry(task.taskId(), outcome.failureCode(), nextAttemptAt);
            appendEvent("notification.retry_scheduled.v1", message.messageId(), context, metadata,
                    java.util.Map.of("messageId", message.messageId(), "attemptNumber", Integer.toString(attemptNumber),
                            "failureCode", outcome.failureCode()));
            appendAudit("notification.retry_scheduled", "RETRYABLE", context.principalId(), message.tenantId(),
                    message.principalId(), MESSAGE_AGGREGATE, message.messageId(), metadata,
                    java.util.Map.of("failureCode", outcome.failureCode(),
                            "attemptNumber", Integer.toString(attemptNumber), "retryable", "true"));
        }
        DeliveryAttempt attempt = new DeliveryAttempt(ids.next("delivery"), message.messageId(), message.channel(),
                attemptNumber, status, outcome.failureCode(), nextAttemptAt, metadata.requestId(),
                metadata.traceId(), now,
                status == DeliveryStatus.RETRY_SCHEDULED);
        store.appendDeliveryAttempt(attempt);
        DeliveryResult result = new DeliveryResult(attempt, nextWorkflow, false);
        store.saveIdempotency(scope, key.value(), new StoredIdempotency(fingerprint, result));
        return result;
    }

    public List<DeliveryAttempt> deliveryAttempts(NotificationPrincipalContext context, String messageId) {
        access.requirePermission(context, "notification.read");
        store.findMessage(context.tenantId(), context.principalId(), messageId).orElseThrow(() ->
                new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                        "notification message was not found"));
        return store.findDeliveryAttempts(messageId);
    }

    private void appendEvent(String eventName, String aggregateId, NotificationPrincipalContext context,
            RequestMetadata metadata, java.util.Map<String, String> attributes) {
        events.append(new NotificationOutboxEvent(ids.next("evt"), eventName, MESSAGE_AGGREGATE, aggregateId,
                context.tenantId(), context.principalId(), metadata.traceId(), metadata.requestId(),
                clock.instant(), SafeEventAttributes.copy(attributes)));
    }

    private void appendAudit(String action, String outcome, String actorId, String tenantId, String principalId,
            String aggregateType, String aggregateId, RequestMetadata metadata,
            java.util.Map<String, String> attributes) {
        audit.append(new com.englishflow.notification.domain.NotificationAuditEvent(ids.next("audit"), action,
                outcome, actorId, tenantId, principalId, aggregateType, aggregateId,
                metadata.requestId(), metadata.traceId(), clock.instant(), attributes));
    }

    private static NotificationAuditEventPort noopAudit() {
        return new NotificationAuditEventPort() {
            @Override
            public void append(com.englishflow.notification.domain.NotificationAuditEvent event) {
            }

            @Override
            public java.util.List<com.englishflow.notification.domain.NotificationAuditEvent> events() {
                return java.util.List.of();
            }
        };
    }

    private static NotificationConsentPort noopConsent() {
        return (tenantId, principalId, channel) -> java.util.Optional.of(true);
    }

    private static void ensureSameFingerprint(StoredIdempotency stored, String fingerprint) {
        if (!stored.fingerprint().equals(fingerprint)) {
            throw new NotificationDomainException(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                    "idempotency key was reused with a different command");
        }
    }

    private static <T> T cast(Object value, Class<T> type) {
        if (!type.isInstance(value)) {
            throw new NotificationDomainException(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                    "idempotency record has an incompatible response");
        }
        return type.cast(value);
    }
}
