package com.englishflow.notification.application;

import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationOutboxEvent;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.SafeEventAttributes;
import com.englishflow.notification.domain.TrustedEventAllowlist;
import com.englishflow.notification.domain.TrustedEventEnvelope;
import com.englishflow.notification.domain.TrustedEventProcessingStatus;
import com.englishflow.notification.domain.TrustedEventReceipt;
import com.englishflow.notification.domain.TrustedEventReceiptStatus;
import com.englishflow.notification.domain.TrustedEventResult;
import com.englishflow.notification.domain.TrustedEventRule;
import com.englishflow.notification.domain.WorkflowTask;
import com.englishflow.notification.port.NotificationAuditEventPort;
import com.englishflow.notification.port.NotificationConsentPort;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.NotificationIdGenerator;
import com.englishflow.notification.port.OutboxEventPort;
import com.englishflow.notification.port.TrustedEventReceiptPort;
import com.englishflow.notification.port.TrustedEventPort;
import com.englishflow.notification.port.WorkflowPort;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;

/**
 * Internal consumer boundary for allow-listed server events. It creates a
 * template-only message or records a terminal filter/rejection; it never
 * writes another domain's database.
 */
public final class TrustedEventApplicationService implements TrustedEventPort {

    public static final String CONSUMER_NAME = "notification.trusted-event";

    private final NotificationApplicationService notifications;
    private final NotificationFactStore facts;
    private final TrustedEventReceiptPort receipts;
    private final NotificationConsentPort consents;
    private final TrustedEventAllowlist allowlist;
    private final NotificationAccessPolicy access;
    private final OutboxEventPort events;
    private final NotificationAuditEventPort audit;
    private final NotificationIdGenerator ids;
    private final WorkflowPort workflow;
    private final Clock clock;

    public TrustedEventApplicationService(NotificationApplicationService notifications,
            NotificationFactStore facts, TrustedEventReceiptPort receipts, NotificationConsentPort consents,
            TrustedEventAllowlist allowlist, NotificationAccessPolicy access, OutboxEventPort events,
            NotificationAuditEventPort audit, NotificationIdGenerator ids, WorkflowPort workflow, Clock clock) {
        this.notifications = notifications;
        this.facts = facts;
        this.receipts = receipts;
        this.consents = consents;
        this.allowlist = allowlist;
        this.access = access;
        this.events = events;
        this.audit = audit;
        this.ids = ids;
        this.workflow = workflow;
        this.clock = clock;
    }

    @Override
    public TrustedEventResult consume(NotificationPrincipalContext consumer,
            TrustedEventEnvelope event, RequestMetadata ignoredMetadata) {
        access.requireTrustedEventConsumer(consumer);
        if (event == null) {
            throw NotificationDomainException.invalid("trusted event is required");
        }
        access.requireTrustedEventConsumer(consumer, event.tenantId());
        Instant now = clock.instant();
        TrustedEventReceipt candidate = new TrustedEventReceipt(CONSUMER_NAME, event.eventId(), event.eventName(),
                event.dedupeKey(), event.fingerprint(), TrustedEventReceiptStatus.RECEIVED, 0,
                null, null, null, now, now);
        TrustedEventReceiptPort.ReceiptClaim claim = receipts.claim(candidate);
        if (!claim.created()) {
            TrustedEventReceipt existing = claim.existing();
            audit(consumer, event, "trusted_event.duplicate", "DUPLICATE",
                    Map.of("eventId", event.eventId(), "dedupeKey", event.dedupeKey()));
            return new TrustedEventResult(event.eventId(), event.dedupeKey(),
                    TrustedEventProcessingStatus.DUPLICATE, "DUPLICATE_EVENT", existing.messageId(),
                    existing.workflowTaskId(), null, true);
        }

        TrustedEventRule rule = allowlist.find(event.eventName()).orElse(null);
        if (rule == null) {
            return reject(consumer, event, candidate, "EVENT_NOT_ALLOWLISTED");
        }
        try {
            rule.validate(event);
        } catch (NotificationDomainException exception) {
            return reject(consumer, event, candidate, reason(exception, "EVENT_ENVELOPE_REJECTED"));
        }

        NotificationPreference preference = facts.findPreference(event.tenantId(), event.principalId(),
                rule.notificationType(), rule.channel()).orElse(null);
        if (preference != null && !preference.enabled()) {
            return filter(consumer, event, candidate, "PREFERENCE_DISABLED");
        }
        if (rule.consentRequired() && (!consumer.consentGranted()
                || !consents.findConsent(event.tenantId(), event.principalId(), rule.channel()).orElse(false))) {
            return filter(consumer, event, candidate, "CONSENT_NOT_GRANTED");
        }

        String locale;
        try {
            locale = rule.resolveLocale(event, preference == null ? null : preference.locale());
        } catch (NotificationDomainException exception) {
            return reject(consumer, event, candidate, reason(exception, "LOCALE_NOT_ALLOWED"));
        }
        Instant notBefore = event.notBefore() == null
                ? now.plus(rule.deliveryDelay())
                : event.notBefore();
        if (notBefore.isBefore(now)) notBefore = now;
        TemplateNotificationCommand command = new TemplateNotificationCommand(rule.notificationType(),
                rule.channel(), rule.templateId(), rule.templateVersion(), locale, event.attributes(),
                "trusted-event-v1", notBefore);
        NotificationMessage message = notifications.queueTrusted(consumer, event.tenantId(), event.principalId(),
                command, new com.englishflow.notification.domain.IdempotencyKey(
                        "trusted-event:" + CONSUMER_NAME + ':' + event.dedupeKey()),
                metadata(event));
        WorkflowTask task = workflow.findByAggregate("notification-message", message.messageId()).orElse(null);
        TrustedEventReceipt applied = candidate.transition(TrustedEventReceiptStatus.APPLIED, 0, null,
                message.messageId(), task == null ? null : task.taskId(), now);
        receipts.save(applied);
        appendEvent("notification.event.accepted.v1", event.eventId(), event,
                Map.of("eventId", event.eventId(), "messageId", message.messageId(),
                        "templateId", message.templateId(), "locale", locale));
        audit(consumer, event, "trusted_event.accepted", "APPLIED",
                Map.of("eventId", event.eventId(), "messageId", message.messageId(),
                        "templateId", message.templateId(), "locale", locale));
        return new TrustedEventResult(event.eventId(), event.dedupeKey(), TrustedEventProcessingStatus.QUEUED,
                null, message.messageId(), task == null ? null : task.taskId(), message.notBefore(), false);
    }

    private TrustedEventResult reject(NotificationPrincipalContext consumer, TrustedEventEnvelope event,
            TrustedEventReceipt receipt, String reasonCode) {
        Instant now = clock.instant();
        receipts.save(receipt.transition(TrustedEventReceiptStatus.REJECTED, 0, reasonCode, null, null, now));
        appendEvent("notification.event.rejected.v1", event.eventId(), event,
                Map.of("eventId", event.eventId(), "reasonCode", reasonCode));
        audit(consumer, event, "trusted_event.rejected", "REJECTED",
                Map.of("eventId", event.eventId(), "reasonCode", reasonCode));
        return new TrustedEventResult(event.eventId(), event.dedupeKey(), TrustedEventProcessingStatus.REJECTED,
                reasonCode, null, null, null, false);
    }

    private TrustedEventResult filter(NotificationPrincipalContext consumer, TrustedEventEnvelope event,
            TrustedEventReceipt receipt, String reasonCode) {
        Instant now = clock.instant();
        receipts.save(receipt.transition(TrustedEventReceiptStatus.FILTERED, 0, reasonCode, null, null, now));
        appendEvent("notification.filtered.v1", event.eventId(), event,
                Map.of("eventId", event.eventId(), "reasonCode", reasonCode));
        audit(consumer, event, "trusted_event.filtered", "FILTERED",
                Map.of("eventId", event.eventId(), "reasonCode", reasonCode));
        return new TrustedEventResult(event.eventId(), event.dedupeKey(), TrustedEventProcessingStatus.FILTERED,
                reasonCode, null, null, null, false);
    }

    private void appendEvent(String eventName, String aggregateId, TrustedEventEnvelope source,
            Map<String, String> attributes) {
        events.append(new NotificationOutboxEvent(ids.next("evt"), eventName, "trusted-notification-event",
                aggregateId, source.tenantId(), source.principalId(), source.traceId(), source.requestId(),
                clock.instant(), SafeEventAttributes.copy(attributes)));
    }

    private void audit(NotificationPrincipalContext consumer, TrustedEventEnvelope source, String action,
            String outcome, Map<String, String> attributes) {
        audit.append(new com.englishflow.notification.domain.NotificationAuditEvent(ids.next("audit"), action,
                outcome, consumer.principalId(), source.tenantId(), source.principalId(),
                "trusted-notification-event", source.eventId(), source.requestId(), source.traceId(),
                clock.instant(), attributes));
    }

    private static RequestMetadata metadata(TrustedEventEnvelope event) {
        return new RequestMetadata(event.requestId(), event.traceId());
    }

    private static String reason(NotificationDomainException exception, String fallback) {
        return switch (exception.code()) {
            case PAYLOAD_NOT_ALLOWED -> "ATTRIBUTE_NOT_ALLOWLISTED";
            case TEMPLATE_NOT_ALLOWED -> "TEMPLATE_NOT_ALLOWLISTED";
            case TRUSTED_EVENT_REJECTED -> "EVENT_ENVELOPE_REJECTED";
            default -> fallback;
        };
    }
}
